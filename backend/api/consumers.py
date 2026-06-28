import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_shelf_ids(user):
    from api.models import Shelf, ShelfShare
    owned = list(Shelf.objects.filter(owner=user).values_list('id', flat=True))
    shared = list(ShelfShare.objects.filter(user=user).values_list('shelf_id', flat=True))
    return list(set(owned + shared))


class UpdateConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')

        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user = user

        # Personal group : events only this user should see
        self.personal_group = f'user_{user.id}'
        await self.channel_layer.group_add(self.personal_group, self.channel_name)

        # Join a group for every shelf this user has access to
        shelf_ids = await get_user_shelf_ids(user)
        self.shelf_groups = [f'shelf_{sid}' for sid in shelf_ids]
        for group in self.shelf_groups:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if not hasattr(self, 'user'):
            return

        await self.channel_layer.group_discard(self.personal_group, self.channel_name)

        for group in getattr(self, 'shelf_groups', []):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data):
        """Client can send 'refresh_shelves' to re-subscribe after role changes."""
        try:
            data = json.loads(text_data)
            if data.get('type') == 'refresh_shelves':
                # Re-join shelf groups (e.g. after a new shelf is shared with them)
                for group in getattr(self, 'shelf_groups', []):
                    await self.channel_layer.group_discard(group, self.channel_name)

                shelf_ids = await get_user_shelf_ids(self.user)
                self.shelf_groups = [f'shelf_{sid}' for sid in shelf_ids]
                for group in self.shelf_groups:
                    await self.channel_layer.group_add(group, self.channel_name)
        except (json.JSONDecodeError, KeyError):
            pass

    # Event handlers (called by channel_layer.group_send) 

    async def book_lent(self, event):
        await self.send(text_data=json.dumps({
            'type': 'book_lent',
            'data': event['data'],
        }))

    async def book_returned(self, event):
        await self.send(text_data=json.dumps({
            'type': 'book_returned',
            'data': event['data'],
        }))

    async def shelf_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'shelf_updated',
            'data': event['data'],
        }))

    async def activity_created(self, event):
        await self.send(text_data=json.dumps({
            'type': 'activity_created',
            'data': event['data'],
        }))

    async def shelf_shared(self, event):
        await self.send(text_data=json.dumps({
            'type': 'shelf_shared',
            'data': event['data'],
        }))