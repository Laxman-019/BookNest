from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
import re
from django.db.models import Q
from .serializers import *
from .models import *


User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(req):
    email = req.data.get('email')
    password = req.data.get('password')
    name = req.data.get('name')
    username = req.data.get('username')

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
    
    user = User.objects.create_user(
        email=email,
        username=username,
        name=name,
        password=password
    )
    
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'username': user.username
        },
        'access': str(refresh.access_token),
        'refresh': str(refresh)
    }, status=status.HTTP_201_CREATED)
    
    
    
@api_view(['POST'])
@permission_classes([AllowAny])
def login(req):
    email = req.data.get('email')
    password = req.data.get('password')
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if not user.check_password(password):
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'username': user.username
        },
        'access': str(refresh.access_token),
        'refresh': str(refresh)
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(req):
    return Response({'message': 'Logged out successfully.'})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def book_list(req):
    user = req.user
    
    if req.method == 'GET':
        books = Book.objects.filter(user=user)
        
      
        search = req.query_params.get('search', '')
        if search:
            books = books.filter(
                Q(title__icontains=search) | Q(author__icontains=search)
            )
        
       
        status_filter = req.query_params.get('status', '')
        if status_filter:
            books = books.filter(status=status_filter)
        
       
        sort_by = req.query_params.get('sort_by', '-created_at')
        allowed_sort_fields = ['rating', 'title', 'created_at']
        if sort_by.lstrip('-') in allowed_sort_fields:
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
                'total_pages': (total + page_size - 1) 
            }
        })
    
    elif req.method == 'POST':
        serializer = BookSerializer(data=req.data)
        if serializer.is_valid():
            book = serializer.save(user=user)
            return Response(BookSerializer(book).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # In book_list POST method, after saving:
    Activity.objects.create(
        user=user,
        action='BOOK_ADDED',
        description=f"Added '{book.title}' by {book.author}",
        metadata={'book_id': book.id}
    )

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def book_detail(req, pk):
    try:
        book = Book.objects.get(pk=pk, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if req.method == 'GET':
        serializer = BookSerializer(book)
        return Response(serializer.data)
    
    elif req.method == 'PUT':
        serializer = BookSerializer(book, data=req.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif req.method == 'DELETE':
        book.delete()
        return Response({'message': 'Book deleted successfully'})
    
    

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def shelf_list(req):
    user = req.user
    
    if req.method == 'GET':
        owned_shelves = Shelf.objects.filter(owner=user)
        shared_shelves = Shelf.objects.filter(shares__user=user)
        shelves = owned_shelves | shared_shelves
        
        serializer = ShelfSerializer(shelves, many=True, context={'request': req})
        return Response(serializer.data)
    
    elif req.method == 'POST':
        serializer = ShelfSerializer(data=req.data, context={'request': req})
        if serializer.is_valid():
            shelf = serializer.save(owner=user)
            return Response(ShelfSerializer(shelf, context={'request': req}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def shelf_detail(req, pk):
    try:
        shelf = Shelf.objects.get(pk=pk)
    except Shelf.DoesNotExist:
        return Response({'error': 'Shelf not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check permission
    if shelf.owner != req.user:
        share = shelf.shares.filter(user=req.user).first()
        if not share:
            return Response({'error': 'You do not have access to this shelf'}, status=status.HTTP_403_FORBIDDEN)
    
    if req.method == 'GET':
        serializer = ShelfSerializer(shelf, context={'request': req})
        return Response(serializer.data)
    
    elif req.method == 'DELETE':
        if shelf.owner != req.user:
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
    
    # Check permission - owner or editor
    has_permission = False
    if shelf.owner == req.user:
        has_permission = True
    else:
        share = shelf.shares.filter(user=req.user, role='EDITOR').first()
        if share:
            has_permission = True
    
    if not has_permission:
        return Response({'error': 'You need editor permissions'}, status=status.HTTP_403_FORBIDDEN)
    
    book_id = req.data.get('book_id')
    if not book_id:
        return Response({'error': 'book_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        book = Book.objects.get(pk=book_id, user=req.user)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if req.method == 'POST':
        shelf.books.add(book)
        serializer = ShelfSerializer(shelf, context={'request': req})
        return Response(serializer.data)
    
    elif req.method == 'DELETE':
        shelf.books.remove(book)
        serializer = ShelfSerializer(shelf, context={'request': req})
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
    
    email = req.data.get('email')
    role = req.data.get('role', 'VIEWER')
    
    if role not in ['VIEWER', 'EDITOR']:
        return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if user == req.user:
        return Response({'error': 'You cannot share with yourself'}, status=status.HTTP_400_BAD_REQUEST)
    
    share, created = ShelfShare.objects.get_or_create(
        shelf=shelf,
        user=user,
        defaults={'role': role}
    )
    
    if not created:
        share.role = role
        share.save()
    
    return Response(ShelfShareSerializer(share).data, status=status.HTTP_201_CREATED)

    #  In share_shelf, after sharing:
    Activity.objects.create(
        user=request.user,
        action='SHELF_SHARED',
        description=f"Shared '{shelf.name}' with {user.email} as {role}",
        metadata={'shelf_id': shelf.id, 'shared_with': user.id, 'role': role}
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shared_with_me(req):
    user = req.user
    shares = ShelfShare.objects.filter(user=user).select_related('shelf')
    result = []
    for share in shares:
        shelf_data = ShelfSerializer(share.shelf, context={'request': req}).data
        shelf_data['shared_role'] = share.role
        result.append(shelf_data)
    return Response(result)