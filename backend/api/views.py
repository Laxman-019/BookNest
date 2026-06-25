from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
import re


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
    try:
        refresh_token = req.data.get('refresh')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'message' : 'Logged out successfully.'})
    
    except Exception:
        return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)