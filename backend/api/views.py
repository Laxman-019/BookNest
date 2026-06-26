from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
import re
from django.db.models import Q
from .serializers import BookSerializer
from .models import Book


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