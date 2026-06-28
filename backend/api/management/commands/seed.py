from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import Book, Shelf, ShelfShare, Activity

User = get_user_model()

class Command(BaseCommand):
    help = 'Seed database with test data for BookNest'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🌱 Seeding database...'))
        
        # Clean existing seed data
        User.objects.filter(email__in=['alice@booknest.dev', 'bob@booknest.dev']).delete()
        
        # ── Users ──
        alice = User.objects.create_user(
            email='alice@booknest.dev',
            username='alice',
            name='Alice Reader',
            password='Password1',
        )
        bob = User.objects.create_user(
            email='bob@booknest.dev',
            username='bob',
            name='Bob Bookworm',
            password='Password1',
        )
        self.stdout.write(self.style.SUCCESS('✅ Created users: alice@booknest.dev / bob@booknest.dev (password: Password1)'))
        
        # ── Alice's books ──
        b1 = Book.objects.create(
            user=alice,
            title='The Pragmatic Programmer',
            author='Andrew Hunt',
            status='FINISHED',
            total_pages=352,
            current_page=352,
            rating=5,
            notes='A must-read for every developer.'
        )
        b2 = Book.objects.create(
            user=alice,
            title='Clean Code',
            author='Robert C. Martin',
            status='READING',
            total_pages=431,
            current_page=120,
            rating=4
        )
        b3 = Book.objects.create(
            user=alice,
            title='Design Patterns',
            author='Gang of Four',
            status='WANT_TO_READ',
            total_pages=395
        )
        b4 = Book.objects.create(
            user=alice,
            title='The Hobbit',
            author='J.R.R. Tolkien',
            status='FINISHED',
            total_pages=310,
            current_page=310,
            rating=5
        )
        
        # ── Bob's books ──
        b5 = Book.objects.create(
            user=bob,
            title='Dune',
            author='Frank Herbert',
            status='READING',
            total_pages=688,
            current_page=200,
            rating=5
        )
        b6 = Book.objects.create(
            user=bob,
            title='Sapiens',
            author='Yuval Noah Harari',
            status='FINISHED',
            total_pages=443,
            current_page=443,
            rating=4
        )
        b7 = Book.objects.create(
            user=bob,
            title='Atomic Habits',
            author='James Clear',
            status='WANT_TO_READ',
            total_pages=320
        )
        self.stdout.write(self.style.SUCCESS('✅ Created books'))
        
        # ── Shelves ──
        shelf_tech = Shelf.objects.create(name='Tech Reads', owner=alice)
        shelf_tech.books.add(b1, b2, b3)
        
        shelf_fiction = Shelf.objects.create(name='Fantasy Shelf', owner=alice)
        shelf_fiction.books.add(b4)
        
        shelf_bob = Shelf.objects.create(name="Bob's Picks", owner=bob)
        shelf_bob.books.add(b5, b6, b7)
        self.stdout.write(self.style.SUCCESS('✅ Created shelves'))
        
        # ── Sharing ──
        ShelfShare.objects.create(shelf=shelf_tech, user=bob, role='EDITOR')
        ShelfShare.objects.create(shelf=shelf_fiction, user=bob, role='VIEWER')
        ShelfShare.objects.create(shelf=shelf_bob, user=alice, role='VIEWER')
        self.stdout.write(self.style.SUCCESS('✅ Shelf sharing configured:'))
        self.stdout.write(self.style.SUCCESS('   • Bob is EDITOR on "Tech Reads" (Alice\'s)'))
        self.stdout.write(self.style.SUCCESS('   • Bob is VIEWER on "Fantasy Shelf" (Alice\'s)'))
        self.stdout.write(self.style.SUCCESS('   • Alice is VIEWER on "Bob\'s Picks" (Bob\'s)'))
        
        # ── Active lending ──
        b1.is_lent = True
        b1.lent_to = bob
        b1.save()
        
        Activity.objects.create(
            user=alice,
            action='BOOK_LENT',
            description="Lent 'The Pragmatic Programmer' to bob@booknest.dev",
            metadata={'book_id': b1.id, 'borrower_id': bob.id}
        )
        self.stdout.write(self.style.SUCCESS('✅ Active lending: Alice lent "The Pragmatic Programmer" to Bob'))
        
        # ── Activity log ──
        Activity.objects.create(
            user=alice,
            action='BOOK_ADDED',
            description="Added 'Clean Code' by Robert C. Martin",
            metadata={'book_id': b2.id}
        )
        Activity.objects.create(
            user=alice,
            action='SHELF_SHARED',
            description="Shared 'Tech Reads' with bob@booknest.dev as EDITOR",
            metadata={'shelf_id': shelf_tech.id}
        )
        Activity.objects.create(
            user=bob,
            action='BOOK_ADDED',
            description="Added 'Dune' by Frank Herbert",
            metadata={'book_id': b5.id}
        )
        self.stdout.write(self.style.SUCCESS('✅ Activity log seeded'))
        
        self.stdout.write(self.style.SUCCESS('\n' + '━' * 70))
        self.stdout.write(self.style.SUCCESS('🎉 Seed complete! Test accounts:'))
        self.stdout.write(self.style.SUCCESS('   alice@booknest.dev  /  Password1'))
        self.stdout.write(self.style.SUCCESS('   bob@booknest.dev    /  Password1'))
        self.stdout.write(self.style.SUCCESS('━' * 70))