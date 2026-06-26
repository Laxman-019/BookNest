from django.urls import path
from .views import *

urlpatterns = [
    path('auth/signup/', signup),
    path('auth/login/', login),
    path('auth/logout/', logout),
    path('book_list/', book_list),
    path('book_detail/', book_detail),
]