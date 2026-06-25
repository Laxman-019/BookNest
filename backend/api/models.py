from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.
class User(AbstractUser):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'name']

    def __str__(self):
        return self.email
    
    
class Book(models.Model):
    STATUS_CHOICES = [
        ('WANT_TO_READ', 'Want to Read'),
        ('READING', 'Reading'),
        ('FINISHED', 'Finished'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='books')
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='WANT_TO_READ')
    total_pages = models.IntegerField(null=True, blank=True)
    current_page = models.IntegerField(default=0)
    rating = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    finished_date = models.DateTimeField(null=True, blank=True)
    lent_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='borrowed_books')
    is_lent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} by {self.author}"