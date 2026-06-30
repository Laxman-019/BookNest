from rest_framework import serializers
from .models import *


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'username']


class BookSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    lent_to_details = UserSerializer(source='lent_to', read_only=True)
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id', 'user', 'user_details', 'title', 'author', 'status',
            'total_pages', 'current_page', 'rating', 'notes',
            'finished_date', 'lent_to', 'lent_to_details', 'is_lent',
            'progress_percentage', 'created_at', 'updated_at',
        ]
        read_only_fields = ['user', 'is_lent', 'finished_date']

    def get_progress_percentage(self, obj):
        if obj.total_pages and obj.total_pages > 0:
            return round((obj.current_page / obj.total_pages) * 100, 2)
        return 0


class ShelfShareSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ShelfShare
        fields = ['id', 'user', 'user_details', 'role', 'shared_at']


class ShelfSerializer(serializers.ModelSerializer):
    books = BookSerializer(many=True, read_only=True)
    owner_details = UserSerializer(source='owner', read_only=True)
    shares = ShelfShareSerializer(many=True, read_only=True)
    book_count = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Shelf
        fields = [
            'id', 'name', 'owner', 'owner_details', 'books',
            'shares', 'book_count', 'user_role', 'created_at', 'updated_at',
        ]
        read_only_fields = ['owner']

    def get_book_count(self, obj):
        return obj.books.count()

    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            if obj.owner == request.user:
                return 'OWNER'
            share = obj.shares.filter(user=request.user).first()
            if share:
                return share.role
        return None
