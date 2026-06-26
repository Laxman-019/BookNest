from django.urls import path
from .views import *

urlpatterns = [
    path('auth/signup/', signup),
    path('auth/login/', login),
    path('auth/logout/', logout),
    path('books/', book_list),
    path('books/<int:pk>/', book_detail),
]