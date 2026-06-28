from django.urls import path
from .views import *

urlpatterns = [
    path('auth/signup/', signup),
    path('auth/login/', login),
    path('auth/logout/', logout),
    path('auth/me/', me),
    path('books/', book_list),
    path('books/<int:pk>/', book_detail),
    path('books/<int:pk>/progress/', update_progress),
    path('lend/', lend_book),
    path('return/<int:book_id>/', return_book),
    path('borrowed/', borrowed_books),
    path('shelves/shared-with-me/', shared_with_me),
    path('shelves/', shelf_list),
    path('shelves/<int:pk>/', shelf_detail),
    path('shelves/<int:pk>/books/', shelf_books),
    path('shelves/<int:pk>/share/', share_shelf),
    path('shelves/<int:pk>/remove-collaborator/', remove_collaborator),
]