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


# helpers 

def _broadcast(group: str, event_type: str, data: dict):
    try:
        async_to_sync(channel_layer.group_send)(group, {
            'type': event_type,   # maps to handler name in consumer
            'data': data,
        })
    except Exception:
        pass   # never crash a REST response because of a WS error


def _broadcast_activity(user_id: int, activity):
    _broadcast(f'user_{user_id}', 'activity_created', {
        'id': activity.id,
        'action': activity.action,
        'description': activity.description,
        'created_at': activity.created_at.isoformat(),
    })


# auth 

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(req):
    email = req.data.get('email', '').strip()
    password = req.data.get('password', '')
    name = req.data.get('name', '').strip()
    username = req.data.get('username', '').strip()

    if not all([email, password, name, username]):
        return Response({'error': 'All fields are required'}, status=status.HTTP_400_BAD_REQUEST)

    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
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
    email = req.data.get('email', '')
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
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(req):
    try:
        refresh_token = req.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
    return Response({'message': 'Logged out successfully.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(req):
    user = req.user
    return Response({'id': user.id, 'email': user.email, 'name': user.name, 'username': user.username})


# books 

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def book_list(req):
    user = req.user

    if req.method == 'GET':
        books = Book.objects.filter(user=user)

        search = req.query_params.get('search', '')
        if search:
            books = books.filter(Q(title__icontains=search) | Q(author__icontains=search))

        status_filter = req.query_params.get('status', '')
        if status_filter:
            books = books.filter(status=status_filter)

        sort_by = req.query_params.get('sort_by', '-created_at')
        allowed_sort_fields = ['rating', '-rating', 'title', '-title', 'created_at', '-created_at']
        if sort_by in allowed_sort_fields:
            books = books.order_by(sort_by)

        page = int(req.query_params.get('page', 1))
        page_size = int(req.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size

        total = books.count()
        books_page = books[start:end]

        serializer = BookSerializer(books_page, many=True)
        return Response({
            'data': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': max(1, (total + page_size - 1) // page_size),  # BUG FIX: was missing // page_size
            }
        })

    # POST
    serializer = BookSerializer(data=req.data)
    if serializer.is_valid():
        book = serializer.save(user=user)

        activity = Activity.objects.create(
            user=user,
            action='BOOK_ADDED',
            description=f"Added '{book.title}' by {book.author}",
            metadata={'book_id': book.id},
        )
        _broadcast_activity(user.id, activity)

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
        if serializer.is_valid():
            updated = serializer.save()

            if updated.status != old_status:
                activity = Activity.objects.create(
                    user=req.user,
                    action='BOOK_STATUS_CHANGED',
                    description=f"Status of '{book.title}' changed to {updated.get_status_display()}",
                    metadata={'book_id': book.id, 'new_status': updated.status},
                )
                _broadcast_activity(req.user.id, activity)

            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    book.delete()
    return Response({'message': 'Book deleted successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_progress(req, pk):
    try:
        book = Book.objects.get(pk=pk, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    current_page = req.data.get('current_page')
    if current_page is None:
        return Response({'error': 'current_page is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        current_page = int(current_page)
    except (ValueError, TypeError):
        return Response({'error': 'current_page must be a number'}, status=status.HTTP_400_BAD_REQUEST)

    if current_page < 0:
        return Response({'error': 'Page cannot be negative'}, status=status.HTTP_400_BAD_REQUEST)

    if book.total_pages is None:
        return Response({'error': 'Total pages is not set for this book'}, status=status.HTTP_400_BAD_REQUEST)

    if current_page > book.total_pages:
        return Response(
            {'error': f'Page cannot exceed total pages ({book.total_pages})'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    book.current_page = current_page

    if current_page == book.total_pages:
        book.status = 'FINISHED'
        book.finished_date = timezone.now()
    elif current_page > 0:
        book.status = 'READING'
        book.finished_date = None

    book.save()

    activity = Activity.objects.create(
        user=req.user,
        action='BOOK_STATUS_CHANGED',
        description=f"Progress updated: '{book.title}' — page {current_page}/{book.total_pages}",
        metadata={'book_id': book.id, 'progress': current_page},
    )
    _broadcast_activity(req.user.id, activity)

    return Response(BookSerializer(book).data)


# shelves 

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def shelf_list(req):
    if req.method == 'GET':
        owned  = Shelf.objects.filter(owner=req.user)
        shared = Shelf.objects.filter(shares__user=req.user)
        shelves = (owned | shared).distinct()
        serializer = ShelfSerializer(shelves, many=True, context={'request': req})
        return Response(serializer.data)

    # POST
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
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # DELETE
    if not is_owner:
        return Response({'error': 'Only the owner can delete this shelf'}, status=status.HTTP_403_FORBIDDEN)
    shelf.delete()
    return Response({'message': 'Shelf deleted successfully'})


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
        return Response({'error': 'You need editor permissions to modify this shelf'}, status=status.HTTP_403_FORBIDDEN)

    book_id = req.data.get('book_id')
    if not book_id:
        return Response({'error': 'book_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(pk=book_id, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found or does not belong to you'}, status=status.HTTP_404_NOT_FOUND)

    if req.method == 'POST':
        shelf.books.add(book)
    else:
        shelf.books.remove(book)

    serializer = ShelfSerializer(shelf, context={'request': req})

    # Broadcast to all shelf collaborators
    _broadcast(f'shelf_{shelf.id}', 'shelf_updated', {
        'shelf_id': shelf.id,
        'shelf': serializer.data,
        'action': 'book_added' if req.method == 'POST' else 'book_removed',
        'book': {'id': book.id, 'title': book.title},
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
    role  = req.data.get('role', 'VIEWER')

    if role not in ['VIEWER', 'EDITOR']:
        return Response({'error': 'Invalid role. Must be VIEWER or EDITOR'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    if target_user == req.user:
        return Response({'error': 'You cannot share a shelf with yourself'}, status=status.HTTP_400_BAD_REQUEST)

    share, created = ShelfShare.objects.get_or_create(
        shelf=shelf, user=target_user,
        defaults={'role': role},
    )
    if not created:
        old_role  = share.role
        share.role = role
        share.save()

        if old_role != role:
            activity = Activity.objects.create(
                user=req.user,
                action='COLLABORATOR_ROLE_CHANGED',
                description=f"Changed {target_user.email}'s role on '{shelf.name}' from {old_role} to {role}",
                metadata={'shelf_id': shelf.id, 'user_id': target_user.id, 'new_role': role},
            )
            _broadcast_activity(req.user.id, activity)

    else:
        activity = Activity.objects.create(
            user=req.user,
            action='SHELF_SHARED',
            description=f"Shared '{shelf.name}' with {target_user.email} as {role}",
            metadata={'shelf_id': shelf.id, 'shared_with': target_user.id, 'role': role},
        )
        _broadcast_activity(req.user.id, activity)

    # Tell the newly-shared user to re-subscribe to shelf groups
    _broadcast(f'user_{target_user.id}', 'shelf_shared', {
        'shelf_id': shelf.id,
        'shelf_name': shelf.name,
        'role': role,
        'shared_by': req.user.name,
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
        target_user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    deleted, _ = ShelfShare.objects.filter(shelf=shelf, user=target_user).delete()
    if not deleted:
        return Response({'error': 'This user is not a collaborator'}, status=status.HTTP_400_BAD_REQUEST)

    activity = Activity.objects.create(
        user=req.user,
        action='COLLABORATOR_REMOVED',
        description=f"Removed {target_user.email} from '{shelf.name}'",
        metadata={'shelf_id': shelf.id, 'removed_user_id': target_user.id},
    )
    _broadcast_activity(req.user.id, activity)

    return Response({'message': f'{target_user.email} removed from shelf'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_with_me(req):
    shares = ShelfShare.objects.filter(user=req.user).select_related('shelf')
    result = []
    for share in shares:
        shelf_data = ShelfSerializer(share.shelf, context={'request': req}).data
        shelf_data['shared_role'] = share.role
        result.append(shelf_data)
    return Response(result)


# lending 

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
        return Response({'error': 'Borrower not found'}, status=status.HTTP_404_NOT_FOUND)

    if borrower == req.user:
        return Response({'error': 'You cannot lend a book to yourself'}, status=status.HTTP_400_BAD_REQUEST)

    if book.is_lent:
        return Response({'error': 'This book is currently lent to someone else'}, status=status.HTTP_400_BAD_REQUEST)

    book.is_lent = True
    book.lent_to = borrower
    book.save()

    activity = Activity.objects.create(
        user=req.user,
        action='BOOK_LENT',
        description=f"Lent '{book.title}' to {borrower.email}",
        metadata={'book_id': book.id, 'borrower_id': borrower.id},
    )
    _broadcast_activity(req.user.id, activity)

    book_data = BookSerializer(book).data

    # Tell the borrower their borrowed list changed — live update
    _broadcast(f'user_{borrower.id}', 'book_lent', {
        'book': book_data,
        'lender': req.user.name,
    })

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

    borrower  = book.lent_to
    book.is_lent = False
    book.lent_to = None
    book.save()

    activity = Activity.objects.create(
        user=req.user,
        action='BOOK_RETURNED',
        description=f"Returned '{book.title}' from {borrower.email if borrower else 'unknown'}",
        metadata={'book_id': book.id},
    )
    _broadcast_activity(req.user.id, activity)

    # Tell the borrower it disappeared — live update
    if borrower:
        _broadcast(f'user_{borrower.id}', 'book_returned', {
            'book_id': book.id,
            'title': book.title,
        })

    return Response(BookSerializer(book).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def borrowed_books(req):
    books = Book.objects.filter(lent_to=req.user, is_lent=True).select_related('user')
    serializer = BookSerializer(books, many=True)
    return Response(serializer.data)