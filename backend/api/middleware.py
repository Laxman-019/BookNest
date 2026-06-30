import logging
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from urllib.parse import parse_qs

logger = logging.getLogger('api.websocket')


@database_sync_to_async
def get_user_from_token(token_key):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        token   = AccessToken(token_key)
        user_id = token['user_id']
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError) as e:
        logger.warning(f"WS auth: invalid/expired token — {e}")
        return AnonymousUser()
    except User.DoesNotExist:
        logger.warning("WS auth: token valid but user no longer exists")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"WS auth: unexpected error — {e}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params       = parse_qs(query_string)
        token_list   = params.get('token', [])

        if token_list:
            scope['user'] = await get_user_from_token(token_list[0])
        else:
            logger.warning("WS auth: no token provided in query string")
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
