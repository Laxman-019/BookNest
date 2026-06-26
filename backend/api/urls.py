from django.urls import path
from .views import *

urlpatterns = [
    path('auth/signup/', signup),
    path('auth/login/', login),
    path('auth/logout/', logout),
    path('books/', book_list),
    path('books/<int:pk>/', book_detail),
    path('shelves/', shelf_list),
    path('shelves/<int:pk>/', shelf_detail),
    path('shelves/<int:pk>/books/', shelf_books),
    path('shelves/<int:pk>/share/', share_shelf),
    path('shelves/shared_with_me/', shared_with_me),
]