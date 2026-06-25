from rest_framework import serializers
from .models import Book, User

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
            'progress_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'is_lent', 'finished_date']
    
    def get_progress_percentage(self, obj):
        if obj.total_pages and obj.total_pages > 0:
            return round((obj.current_page / obj.total_pages) * 100, 2)
        return 0
    