from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Q, Avg, Count
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import re

from .serializers import *
from .models import *

User = get_user_model()
channel_layer = get_channel_layer()


# Internal helpers

def _broadcast(group: str, event_type: str, data: dict):
    try:
        async_to_sync(channel_layer.group_send)(group, {'type': event_type, 'data': data})
    except Exception:
        pass


def _log(user, action, description, metadata=None):
    activity = Activity.objects.create(
        user=user, action=action, description=description, metadata=metadata or {}
    )
    _broadcast(f'user_{user.id}', 'activity_created', {
        'id': activity.id, 'action': activity.action,
        'description': activity.description,
        'created_at': activity.created_at.isoformat(),
        'metadata': activity.metadata,
    })
    return activity

 
# 1. AUTHENTICATION 


@api_view(['POST'])
@permission_classes([AllowAny])
def signup(req):
    email = req.data.get('email', '').strip()
    password = req.data.get('password', '')
    name = req.data.get('name', '').strip()
    username = req.data.get('username', '').strip()

    if not all([email, password, name, username]):
        return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        return Response({'error': 'Invalid email format'}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 8:
        return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)
    if not any(c.isupper() for c in password):
        return Response({'error': 'Password must contain an uppercase letter'}, status=status.HTTP_400_BAD_REQUEST)
    if not any(c.islower() for c in password):
        return Response({'error': 'Password must contain a lowercase letter'}, status=status.HTTP_400_BAD_REQUEST)
    if not any(c.isdigit() for c in password):
        return Response({'error': 'Password must contain a number'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(email=email, username=username, name=name, password=password)
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': {'id': user.id, 'email': user.email, 'name': user.name, 'username': user.username},
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(req):
    email = req.data.get('email', '').strip()
    password = req.data.get('password', '')
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.check_password(password):
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    refresh = RefreshToken.for_user(user)
    return Response({
        'user': {'id': user.id, 'email': user.email, 'name': user.name, 'username': user.username},
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(req):
    try:
        RefreshToken(req.data.get('refresh')).blacklist()
    except Exception:
        pass
    return Response({'message': 'Logged out successfully.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(req):
    u = req.user
    return Response({'id': u.id, 'email': u.email, 'name': u.name, 'username': u.username})


# 2. DASHBOARD


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(req):
    user = req.user
    this_year = timezone.now().year
    books = Book.objects.filter(user=user)

    total_books = books.count()
    status_counts = {
        'WANT_TO_READ': books.filter(status='WANT_TO_READ').count(),
        'READING': books.filter(status='READING').count(),
        'FINISHED': books.filter(status='FINISHED').count(),
    }
    finished_this_year = books.filter(status='FINISHED', finished_date__year=this_year).count()
    avg_raw = books.filter(rating__isnull=False).aggregate(avg=Avg('rating'))['avg']
    avg_rating = round(avg_raw, 2) if avg_raw else None

    top_shelf = (
        Shelf.objects.filter(owner=user)
        .annotate(count=Count('books'))
        .order_by('-count')
        .first()
    )

    lent_out_count = books.filter(is_lent=True).count()
    shared_with_me_count = ShelfShare.objects.filter(user=user).count()

    activities = Activity.objects.filter(user=user).order_by('-created_at')[:20]
    activity_data = [
        {'id': a.id, 'action': a.action, 'description': a.description,
         'created_at': a.created_at.isoformat(), 'metadata': a.metadata}
        for a in activities
    ]

    return Response({
        'total_books': total_books,
        'status_counts': status_counts,
        'finished_this_year': finished_this_year,
        'average_rating': avg_rating,
        'top_shelf': {'id': top_shelf.id, 'name': top_shelf.name,
        'book_count': top_shelf.count} if top_shelf else None,
        'books_lent_out': lent_out_count,
        'shelves_shared_with_me': shared_with_me_count,
        'recent_activities': activity_data,
    })


# 3. BOOK MANAGEMENT

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def book_list(req):
    user = req.user

    if req.method == 'GET':
        books = Book.objects.filter(user=user)
        search = req.query_params.get('search', '').strip()
        if search:
            books = books.filter(Q(title__icontains=search) | Q(author__icontains=search))
        status_filter = req.query_params.get('status', '')
        if status_filter:
            books = books.filter(status=status_filter)
        sort_by = req.query_params.get('sort_by', '-created_at')
        if sort_by in ['rating', '-rating', 'title', '-title', 'created_at', '-created_at']:
            books = books.order_by(sort_by)
        page = max(1, int(req.query_params.get('page', 1)))
        page_size = max(1, int(req.query_params.get('page_size', 10)))
        total = books.count()
        return Response({
            'data': BookSerializer(books[(page-1)*page_size: page*page_size], many=True).data,
            'pagination': {
                'page': page, 'page_size': page_size, 'total': total,
                'total_pages': max(1, (total + page_size - 1) // page_size),
            },
        })

    serializer = BookSerializer(data=req.data)
    if serializer.is_valid():
        book = serializer.save(user=user)
        _log(user, 'BOOK_ADDED', f"Added '{book.title}' by {book.author}", {'book_id': book.id})
        return Response(BookSerializer(book).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def book_detail(req, pk):
    try:
        book = Book.objects.get(pk=pk, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    if req.method == 'GET':
        return Response(BookSerializer(book).data)

    if req.method == 'PUT':
        old_status = book.status
        serializer = BookSerializer(book, data=req.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        if updated.status != old_status:
            _log(req.user, 'BOOK_STATUS_CHANGED',
                 f"Status of '{updated.title}' changed to {updated.get_status_display()}",
                 {'book_id': book.id, 'old_status': old_status, 'new_status': updated.status})
        else:
            _log(req.user, 'BOOK_UPDATED',
                 f"Updated '{updated.title}'",
                 {'book_id': book.id})
        return Response(serializer.data)

    # DELETE — capture affected shelves BEFORE deleting (M2M rows vanish on delete)
    title = book.title
    affected_shelf_ids = list(book.shelves.values_list('id', flat=True))
    book.delete()

    for shelf_id in affected_shelf_ids:
        _broadcast(f'shelf_{shelf_id}', 'shelf_updated', {
            'shelf_id': shelf_id,
            'shelf': None,           
            'action': 'book_deleted',
            'book': {'id': pk, 'title': title},
            'by': req.user.name,
        })

    return Response({'message': f"'{title}' deleted successfully"})


# 6. READING PROGRESS


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_progress(req, pk):
    try:
        book = Book.objects.get(pk=pk, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    if book.total_pages is None:
        return Response(
            {'error': 'Cannot track progress: total pages is not set for this book'},
            status=status.HTTP_400_BAD_REQUEST)

    raw = req.data.get('current_page')
    if raw is None:
        return Response({'error': 'current_page is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        current_page = int(raw)
    except (ValueError, TypeError):
        return Response({'error': 'current_page must be a whole number'}, status=status.HTTP_400_BAD_REQUEST)

    if current_page < 0:
        return Response({'error': 'Page number cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)
    if current_page > book.total_pages:
        return Response(
            {'error': f'Page {current_page} exceeds total pages ({book.total_pages})'},
            status=status.HTTP_400_BAD_REQUEST)

    book.current_page = current_page
    if current_page == book.total_pages:
        book.status = 'FINISHED'
        book.finished_date = timezone.now()
        _log(req.user, 'BOOK_STATUS_CHANGED',
             f"Finished '{book.title}'",
             {'book_id': book.id, 'new_status': 'FINISHED'})
    elif current_page > 0:
        book.status = 'READING'
        book.finished_date = None
        _log(req.user, 'BOOK_STATUS_CHANGED',
             f"Reading '{book.title}': page {current_page}/{book.total_pages}",
             {'book_id': book.id, 'progress': current_page})
    book.save()
    return Response(BookSerializer(book).data)


# 4 & 5. SHELVES + SHARED SHELVES


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def shelf_list(req):
    if req.method == 'GET':
        owned  = Shelf.objects.filter(owner=req.user)
        shared = Shelf.objects.filter(shares__user=req.user)
        shelves = (owned | shared).distinct()
        return Response(ShelfSerializer(shelves, many=True, context={'request': req}).data)
    serializer = ShelfSerializer(data=req.data, context={'request': req})
    if serializer.is_valid():
        shelf = serializer.save(owner=req.user)
        return Response(ShelfSerializer(shelf, context={'request': req}).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def shelf_detail(req, pk):
    try:
        shelf = Shelf.objects.get(pk=pk)
    except Shelf.DoesNotExist:
        return Response({'error': 'Shelf not found'}, status=status.HTTP_404_NOT_FOUND)

    is_owner = shelf.owner == req.user
    share = shelf.shares.filter(user=req.user).first()

    if not is_owner and not share:
        return Response({'error': 'You do not have access to this shelf'}, status=status.HTTP_403_FORBIDDEN)

    if req.method == 'GET':
        return Response(ShelfSerializer(shelf, context={'request': req}).data)

    if req.method == 'PUT':
        if not is_owner:
            return Response({'error': 'Only the owner can edit this shelf'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ShelfSerializer(shelf, data=req.data, partial=True, context={'request': req})
        if serializer.is_valid():
            updated = serializer.save()
            return Response(ShelfSerializer(updated, context={'request': req}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not is_owner:
        return Response({'error': 'Only the owner can delete this shelf'}, status=status.HTTP_403_FORBIDDEN)
    shelf.delete()
    return Response({'message': 'Shelf deleted. Books were not deleted.'})


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def shelf_books(req, pk):
    try:
        shelf = Shelf.objects.get(pk=pk)
    except Shelf.DoesNotExist:
        return Response({'error': 'Shelf not found'}, status=status.HTTP_404_NOT_FOUND)

    is_owner = shelf.owner == req.user
    share = shelf.shares.filter(user=req.user).first()

    if not is_owner and (not share or share.role != 'EDITOR'):
        return Response(
            {'error': 'Only the shelf owner or an editor can add or remove books'},
            status=status.HTTP_403_FORBIDDEN)

    book_id = req.data.get('book_id')
    if not book_id:
        return Response({'error': 'book_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(pk=book_id, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found or does not belong to you'}, status=status.HTTP_404_NOT_FOUND)

    if req.method == 'POST':
        shelf.books.add(book)
        action_label = 'book_added'
    else:
        shelf.books.remove(book)
        action_label = 'book_removed'

    serializer = ShelfSerializer(shelf, context={'request': req})
    _broadcast(f'shelf_{shelf.id}', 'shelf_updated', {
        'shelf_id': shelf.id, 'shelf': serializer.data,
        'action': action_label, 'book': {'id': book.id, 'title': book.title},
        'by': req.user.name,
    })
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_shelf(req, pk):
    try:
        shelf = Shelf.objects.get(pk=pk)
    except Shelf.DoesNotExist:
        return Response({'error': 'Shelf not found'}, status=status.HTTP_404_NOT_FOUND)

    if shelf.owner != req.user:
        return Response({'error': 'Only the owner can share this shelf'}, status=status.HTTP_403_FORBIDDEN)

    email = req.data.get('email', '').strip()
    role = req.data.get('role', 'VIEWER')
    if role not in ['VIEWER', 'EDITOR']:
        return Response({'error': 'Role must be VIEWER or EDITOR'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'No user found with that email'}, status=status.HTTP_404_NOT_FOUND)

    if target == req.user:
        return Response({'error': 'You cannot share a shelf with yourself'}, status=status.HTTP_400_BAD_REQUEST)

    share, created = ShelfShare.objects.get_or_create(shelf=shelf, user=target, defaults={'role': role})
    if not created:
        old_role = share.role
        share.role = role
        share.save()
        if old_role != role:
            _log(req.user, 'COLLABORATOR_ROLE_CHANGED',
                 f"Changed {target.email}'s role on '{shelf.name}' from {old_role} to {role}",
                 {'shelf_id': shelf.id, 'user_id': target.id, 'old_role': old_role, 'new_role': role})
    else:
        _log(req.user, 'SHELF_SHARED',
             f"Shared '{shelf.name}' with {target.email} as {role}",
             {'shelf_id': shelf.id, 'shared_with': target.id, 'role': role})

    _broadcast(f'user_{target.id}', 'shelf_shared', {
        'shelf_id': shelf.id, 'shelf_name': shelf.name,
        'role': role, 'shared_by': req.user.name,
    })
    return Response(ShelfShareSerializer(share).data,
                    status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_collaborator(req, pk):
    try:
        shelf = Shelf.objects.get(pk=pk)
    except Shelf.DoesNotExist:
        return Response({'error': 'Shelf not found'}, status=status.HTTP_404_NOT_FOUND)

    if shelf.owner != req.user:
        return Response({'error': 'Only the owner can remove collaborators'}, status=status.HTTP_403_FORBIDDEN)

    email = req.data.get('email', '').strip()
    try:
        target = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    deleted, _ = ShelfShare.objects.filter(shelf=shelf, user=target).delete()
    if not deleted:
        return Response({'error': 'This user is not a collaborator on this shelf'}, status=status.HTTP_400_BAD_REQUEST)

    _log(req.user, 'COLLABORATOR_REMOVED',
         f"Removed {target.email} from '{shelf.name}'",
         {'shelf_id': shelf.id, 'removed_user_id': target.id})
    return Response({'message': f'{target.email} has been removed from this shelf'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_with_me(req):
    shares = ShelfShare.objects.filter(user=req.user).select_related('shelf')
    result = []
    for share in shares:
        data                = ShelfSerializer(share.shelf, context={'request': req}).data
        data['shared_role'] = share.role
        result.append(data)
    return Response(result)


# 7. LENDING


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lend_book(req):
    book_id        = req.data.get('book_id')
    borrower_email = req.data.get('borrower_email', '').strip()

    if not book_id or not borrower_email:
        return Response({'error': 'book_id and borrower_email are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(pk=book_id, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found or does not belong to you'}, status=status.HTTP_404_NOT_FOUND)

    try:
        borrower = User.objects.get(email=borrower_email)
    except User.DoesNotExist:
        return Response({'error': 'No user found with that email'}, status=status.HTTP_404_NOT_FOUND)

    if borrower == req.user:
        return Response({'error': 'You cannot lend a book to yourself'}, status=status.HTTP_400_BAD_REQUEST)

    if book.is_lent:
        return Response(
            {'error': f"This book is already lent to {book.lent_to.email if book.lent_to else 'someone'}"},
            status=status.HTTP_400_BAD_REQUEST)

    book.is_lent = True
    book.lent_to = borrower
    book.save()

    _log(req.user, 'BOOK_LENT',
         f"Lent '{book.title}' to {borrower.email}",
         {'book_id': book.id, 'borrower_id': borrower.id})

    book_data = BookSerializer(book).data
    _broadcast(f'user_{borrower.id}', 'book_lent', {'book': book_data, 'lender': req.user.name})
    return Response(book_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def return_book(req, book_id):
    try:
        book = Book.objects.get(pk=book_id, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found or does not belong to you'}, status=status.HTTP_404_NOT_FOUND)

    if not book.is_lent:
        return Response({'error': 'This book is not currently lent out'}, status=status.HTTP_400_BAD_REQUEST)

    borrower = book.lent_to
    book.is_lent = False
    book.lent_to = None
    book.save()

    _log(req.user, 'BOOK_RETURNED',
         f"'{book.title}' returned from {borrower.email if borrower else 'unknown'}",
         {'book_id': book.id, 'borrower_id': borrower.id if borrower else None})

    if borrower:
        _broadcast(f'user_{borrower.id}', 'book_returned', {'book_id': book.id, 'title': book.title})

    return Response(BookSerializer(book).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def borrowed_books(req):
    books = Book.objects.filter(lent_to=req.user, is_lent=True).select_related('user')
    return Response(BookSerializer(books, many=True).data)
