import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger('api.websocket')


@database_sync_to_async
def get_user_shelf_ids(user):
    from api.models import Shelf, ShelfShare
    owned  = list(Shelf.objects.filter(owner=user).values_list('id', flat=True))
    shared = list(ShelfShare.objects.filter(user=user).values_list('shelf_id', flat=True))
    return list(set(owned + shared))


class UpdateConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')

        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            logger.warning("WS connect rejected: unauthenticated")
            await self.close(code=4001)
            return

        self.user = user
        logger.info(f"WS connected: user={user.email} (id={user.id})")

        self.personal_group = f'user_{user.id}'
        await self.channel_layer.group_add(self.personal_group, self.channel_name)

        shelf_ids = await get_user_shelf_ids(user)
        self.shelf_groups = [f'shelf_{sid}' for sid in shelf_ids]
        for group in self.shelf_groups:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if not hasattr(self, 'user'):
            return
        logger.info(f"WS disconnected: user={self.user.email} code={close_code}")

        await self.channel_layer.group_discard(self.personal_group, self.channel_name)
        for group in getattr(self, 'shelf_groups', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'refresh_shelves':
                for group in getattr(self, 'shelf_groups', []):
                    await self.channel_layer.group_discard(group, self.channel_name)
                shelf_ids = await get_user_shelf_ids(self.user)
                self.shelf_groups = [f'shelf_{sid}' for sid in shelf_ids]
                for group in self.shelf_groups:
                    await self.channel_layer.group_add(group, self.channel_name)
        except (json.JSONDecodeError, KeyError):
            pass

    # Event handlers 
    async def book_lent(self, event):
        await self.send(text_data=json.dumps({'type': 'book_lent', 'data': event['data']}))

    async def book_returned(self, event):
        await self.send(text_data=json.dumps({'type': 'book_returned', 'data': event['data']}))

    async def shelf_updated(self, event):
        await self.send(text_data=json.dumps({'type': 'shelf_updated', 'data': event['data']}))

    async def activity_created(self, event):
        await self.send(text_data=json.dumps({'type': 'activity_created', 'data': event['data']}))

    async def shelf_shared(self, event):
        await self.send(text_data=json.dumps({'type': 'shelf_shared', 'data': event['data']}))
