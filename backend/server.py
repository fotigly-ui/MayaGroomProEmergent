from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Google Calendar imports
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Supabase configuration for backups
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
supabase_client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logging.info("Supabase client initialized for backups")
    except Exception as e:
        logging.warning(f"Supabase initialization failed: {e}")

# Google Calendar Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', '')
GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar']

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'maya-groom-pro-secret-key-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI(title="Maya Groom Pro API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    business_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# Default SMS Templates
DEFAULT_SMS_TEMPLATES = {
    "appointment_booked": {
        "name": "Appointment Booked",
        "template": "Hi {client_name}! Your appointment for {pet_names} at {business_name} is confirmed for {date} at {time}. See you then! Reply CONFIRM to confirm.",
        "enabled": True
    },
    "appointment_changed": {
        "name": "Appointment Changed",
        "template": "Hi {client_name}, your appointment for {pet_names} at {business_name} has been updated. New details: {date} at {time}. Reply CONFIRM to confirm.",
        "enabled": True
    },
    "appointment_rescheduled": {
        "name": "Appointment Rescheduled",
        "template": "Hi {client_name}, your appointment has been rescheduled to {date} at {time}. If this doesn't work, please call us at {business_phone}.",
        "enabled": True
    },
    "appointment_cancelled": {
        "name": "Appointment Cancelled",
        "template": "Hi {client_name}, your appointment for {pet_names} on {date} at {business_name} has been cancelled. Contact us to rebook: {business_phone}",
        "enabled": True
    },
    "no_show": {
        "name": "No Show",
        "template": "Hi {client_name}, we missed you today at {business_name}! Please contact us at {business_phone} to reschedule your appointment for {pet_names}.",
        "enabled": True
    },
    "confirmation_request": {
        "name": "Confirmation Request",
        "template": "Hi {client_name}! Reminder: You have an appointment for {pet_names} at {business_name} on {date} at {time}. Reply CONFIRM to confirm or call {business_phone} to reschedule.",
        "enabled": True
    },
    "reminder_24h": {
        "name": "24-Hour Reminder",
        "template": "Hi {client_name}! Just a reminder: {pet_names} appointment tomorrow at {time} at {business_name}. See you soon!",
        "enabled": True
    }
}

# Settings Model
class Settings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    business_name: str = ""
    abn: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    pay_id: str = ""
    bank_name: str = ""
    bsb: str = ""
    account_number: str = ""
    account_name: str = ""
    gst_enabled: bool = False
    gst_rate: float = 10.0
    use_24_hour_clock: bool = True
    logo_data_url: str = ""
    # SMS Settings
    sms_enabled: bool = False
    sms_mode: str = "manual"  # "manual" or "automated"
    sms_provider: str = ""  # "twilio" or "native" (for using own phone)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    sms_templates: dict = Field(default_factory=lambda: DEFAULT_SMS_TEMPLATES.copy())
    # Reminder settings
    send_confirmation_request: bool = True
    confirmation_request_value: int = 2  # Number value
    confirmation_request_unit: str = "days"  # days, weeks, months
    send_24h_reminder: bool = True
    reminder_value: int = 24  # Number value
    reminder_unit: str = "hours"  # hours, days
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettingsUpdate(BaseModel):
    business_name: Optional[str] = None
    abn: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    pay_id: Optional[str] = None
    bank_name: Optional[str] = None
    bsb: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None
    gst_enabled: Optional[bool] = None
    gst_rate: Optional[float] = None
    use_24_hour_clock: Optional[bool] = None
    logo_data_url: Optional[str] = None
    # SMS Settings
    sms_enabled: Optional[bool] = None
    sms_mode: Optional[str] = None
    sms_provider: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None
    sms_templates: Optional[dict] = None
    send_confirmation_request: Optional[bool] = None
    confirmation_request_value: Optional[int] = None
    confirmation_request_unit: Optional[str] = None
    send_24h_reminder: Optional[bool] = None
    reminder_value: Optional[int] = None
    reminder_unit: Optional[str] = None

# Client Model
class ClientCreate(BaseModel):
    name: str
    first_name: str = ""
    surname: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    street_address: str = ""
    suburb: str = ""
    state: str = ""
    postcode: str = ""

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    first_name: str = ""
    surname: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    street_address: str = ""
    suburb: str = ""
    state: str = ""
    postcode: str = ""
    no_show_count: int = 0
    last_no_show: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    surname: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    street_address: Optional[str] = None
    suburb: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None

# Pet Model
class PetCreate(BaseModel):
    client_id: str
    name: str
    breed: str = ""
    age: str = ""
    notes: str = ""

class Pet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    name: str
    breed: str = ""
    age: str = ""
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PetUpdate(BaseModel):
    name: Optional[str] = None
    breed: Optional[str] = None
    age: Optional[str] = None
    notes: Optional[str] = None

# Service Model
class ServiceCreate(BaseModel):
    name: str
    duration: int = 60  # in minutes
    price: float = 0.0

class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    duration: int = 60
    price: float = 0.0
    type: str = "service"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration: Optional[int] = None
    price: Optional[float] = None

# Item Model
class ItemCreate(BaseModel):
    name: str
    price: float = 0.0

class Item(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    price: float = 0.0
    type: str = "item"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None

# Appointment Pet Model
class AppointmentPetCreate(BaseModel):
    pet_name: str
    pet_id: Optional[str] = None
    services: List[str] = Field(default_factory=list)  # Service IDs
    items: List[str] = Field(default_factory=list)  # Item IDs

class AppointmentPet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pet_name: str
    pet_id: Optional[str] = None
    services: List[str] = Field(default_factory=list)
    items: List[str] = Field(default_factory=list)

# Appointment Model
class AppointmentCreate(BaseModel):
    client_id: str
    date_time: datetime
    notes: str = ""
    is_recurring: bool = False
    recurring_value: Optional[int] = None
    recurring_unit: Optional[str] = None  # day, week, month, year
    recurring_id: Optional[str] = None
    pets: List[AppointmentPetCreate] = Field(default_factory=list)

class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    client_name: str = ""
    date_time: datetime
    end_time: datetime
    status: str = "scheduled"  # scheduled, completed, cancelled, no_show
    notes: str = ""
    is_recurring: bool = False
    recurring_value: Optional[int] = None
    recurring_unit: Optional[str] = None
    recurring_id: Optional[str] = None
    pets: List[AppointmentPet] = Field(default_factory=list)
    total_duration: int = 0
    total_price: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentUpdate(BaseModel):
    date_time: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_value: Optional[int] = None
    recurring_unit: Optional[str] = None
    pets: Optional[List[AppointmentPetCreate]] = None
    update_series: Optional[bool] = False

# Waitlist Model
class WaitlistCreate(BaseModel):
    client_id: str
    preferred_date: str = ""
    preferred_timeframe: str = ""  # 8-12, 12-5, any
    preferred_pets: List[str] = Field(default_factory=list)
    preferred_services: List[str] = Field(default_factory=list)
    notes: str = ""

class Waitlist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    client_name: str = ""
    preferred_date: str = ""
    preferred_timeframe: str = ""
    preferred_pets: List[str] = Field(default_factory=list)
    preferred_services: List[str] = Field(default_factory=list)
    notes: str = ""
    date_added: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WaitlistUpdate(BaseModel):
    preferred_date: Optional[str] = None
    preferred_timeframe: Optional[str] = None
    preferred_pets: Optional[List[str]] = None
    preferred_services: Optional[List[str]] = None
    notes: Optional[str] = None

# Recurring Template Model
class RecurringTemplateCreate(BaseModel):
    client_id: str
    frequency: str = "weekly"  # weekly, biweekly, monthly
    time: str = "09:00"
    day_of_week: int = 0  # 0=Monday, 6=Sunday
    pets_services: List[AppointmentPetCreate] = Field(default_factory=list)

class RecurringTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    client_name: str = ""
    frequency: str = "weekly"
    time: str = "09:00"
    day_of_week: int = 0
    pets_services: List[AppointmentPet] = Field(default_factory=list)
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# SMS Message Log Model
class SMSMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    client_name: str = ""
    phone: str
    message_type: str  # appointment_booked, confirmation_request, etc.
    message_text: str
    status: str = "pending"  # pending, sent, failed, delivered
    sent_at: Optional[datetime] = None
    appointment_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SendSMSRequest(BaseModel):
    client_id: str
    message_type: str
    appointment_id: Optional[str] = None
    custom_message: Optional[str] = None

# Invoice Models
class InvoiceItem(BaseModel):
    name: str
    quantity: int = 1
    unit_price: float
    total: float

class InvoiceCreate(BaseModel):
    appointment_id: Optional[str] = None
    client_id: str
    items: List[InvoiceItem] = Field(default_factory=list)
    notes: str = ""
    due_date: Optional[datetime] = None
    discount: float = 0.0  # Discount amount

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    user_id: str
    appointment_id: Optional[str] = None
    client_id: str
    client_name: str = ""
    client_email: str = ""
    client_phone: str = ""
    client_address: str = ""
    items: List[InvoiceItem] = Field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0  # Discount amount
    gst_amount: float = 0.0
    total: float = 0.0
    notes: str = ""
    status: str = "draft"  # draft, sent, paid, overdue, cancelled
    due_date: Optional[str] = None
    paid_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceUpdate(BaseModel):
    items: Optional[List[InvoiceItem]] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    try:
        # MongoDB stores hashes as strings, bcrypt expects bytes
        # Simply encode both the password and the stored hash
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== HELPER FUNCTIONS ====================

def serialize_datetime(obj):
    """Convert datetime objects to ISO strings for MongoDB"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def prepare_doc_for_mongo(doc: dict) -> dict:
    """Prepare a document for MongoDB insertion"""
    return {k: serialize_datetime(v) for k, v in doc.items()}

def parse_datetime_fields(doc: dict, fields: List[str]) -> dict:
    """Parse datetime strings back to datetime objects"""
    for field in fields:
        if field in doc and isinstance(doc[field], str):
            doc[field] = datetime.fromisoformat(doc[field].replace('Z', '+00:00'))
    return doc

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create default settings
    settings = Settings(user_id=user_id, business_name=user.business_name)
    settings_doc = prepare_doc_for_mongo(settings.model_dump())
    await db.settings.insert_one(settings_doc)
    
    token = create_access_token(user_id)
    return Token(access_token=token)

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email}, {"_id": 0})
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(db_user["id"])
    return Token(access_token=token)

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordResponse(BaseModel):
    message: str
    temporary_password: Optional[str] = None

@api_router.post("/auth/forgot-password", response_model=ResetPasswordResponse)
async def forgot_password(request: ForgotPasswordRequest):
    # Check if user exists
    db_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    if not db_user:
        # Return generic message to prevent email enumeration
        return ResetPasswordResponse(message="If an account exists with this email, a temporary password will be generated.")
    
    # Generate a temporary password
    import secrets
    import string
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    # Hash and update the password
    new_hash = hash_password(temp_password)
    await db.users.update_one(
        {"id": db_user["id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    return ResetPasswordResponse(
        message="Your password has been reset. Please use the temporary password below to login, then change it in Settings.",
        temporary_password=temp_password
    )

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, user_id: str = Depends(get_current_user)):
    # Get user
    db_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(request.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Hash and update password
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": new_hash}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ==================== SETTINGS ROUTES ====================

@api_router.get("/settings", response_model=Settings)
async def get_settings(user_id: str = Depends(get_current_user)):
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    if not settings:
        # Create default settings if not exists
        new_settings = Settings(user_id=user_id)
        settings_doc = prepare_doc_for_mongo(new_settings.model_dump())
        await db.settings.insert_one(settings_doc)
        return new_settings
    return parse_datetime_fields(settings, ["created_at", "updated_at"])

@api_router.put("/settings", response_model=Settings)
async def update_settings(update: SettingsUpdate, user_id: str = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one({"user_id": user_id}, {"$set": update_data})
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    return parse_datetime_fields(settings, ["created_at", "updated_at"])

# ==================== CLIENT ROUTES ====================

@api_router.post("/clients", response_model=Client)
async def create_client(client: ClientCreate, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    new_client = Client(user_id=user_id, **client.model_dump())
    client_doc = prepare_doc_for_mongo(new_client.model_dump())
    await db.clients.insert_one(client_doc)
    # Trigger backup
    background_tasks.add_task(backup_collection_to_supabase, "clients", user_id)
    return new_client

@api_router.get("/clients", response_model=List[Client])
async def get_clients(search: str = "", user_id: str = Depends(get_current_user)):
    query = {"user_id": user_id}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    clients = await db.clients.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return [parse_datetime_fields(c, ["created_at"]) for c in clients]

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str, user_id: str = Depends(get_current_user)):
    client = await db.clients.find_one({"id": client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return parse_datetime_fields(client, ["created_at"])

@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, update: ClientUpdate, user_id: str = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.clients.update_one(
        {"id": client_id, "user_id": user_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return parse_datetime_fields(client, ["created_at"])

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user_id: str = Depends(get_current_user)):
    result = await db.clients.delete_one({"id": client_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    # Also delete associated pets
    await db.pets.delete_many({"client_id": client_id, "user_id": user_id})
    return {"message": "Client deleted"}

# ==================== PET ROUTES ====================

@api_router.post("/pets", response_model=Pet)
async def create_pet(pet: PetCreate, user_id: str = Depends(get_current_user)):
    # Verify client exists
    client = await db.clients.find_one({"id": pet.client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    new_pet = Pet(user_id=user_id, **pet.model_dump())
    pet_doc = prepare_doc_for_mongo(new_pet.model_dump())
    await db.pets.insert_one(pet_doc)
    return new_pet

@api_router.get("/pets", response_model=List[Pet])
async def get_pets(client_id: str = "", user_id: str = Depends(get_current_user)):
    query = {"user_id": user_id}
    if client_id:
        query["client_id"] = client_id
    pets = await db.pets.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return [parse_datetime_fields(p, ["created_at"]) for p in pets]

@api_router.get("/pets/{pet_id}", response_model=Pet)
async def get_pet(pet_id: str, user_id: str = Depends(get_current_user)):
    pet = await db.pets.find_one({"id": pet_id, "user_id": user_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return parse_datetime_fields(pet, ["created_at"])

@api_router.put("/pets/{pet_id}", response_model=Pet)
async def update_pet(pet_id: str, update: PetUpdate, user_id: str = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.pets.update_one({"id": pet_id, "user_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pet not found")
    
    pet = await db.pets.find_one({"id": pet_id}, {"_id": 0})
    return parse_datetime_fields(pet, ["created_at"])

@api_router.delete("/pets/{pet_id}")
async def delete_pet(pet_id: str, user_id: str = Depends(get_current_user)):
    result = await db.pets.delete_one({"id": pet_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pet not found")
    return {"message": "Pet deleted"}

# ==================== SERVICE ROUTES ====================

@api_router.post("/services", response_model=Service)
async def create_service(service: ServiceCreate, user_id: str = Depends(get_current_user)):
    new_service = Service(user_id=user_id, **service.model_dump())
    service_doc = prepare_doc_for_mongo(new_service.model_dump())
    await db.services.insert_one(service_doc)
    return new_service

@api_router.get("/services", response_model=List[Service])
async def get_services(user_id: str = Depends(get_current_user)):
    services = await db.services.find({"user_id": user_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [parse_datetime_fields(s, ["created_at"]) for s in services]

@api_router.get("/services/{service_id}", response_model=Service)
async def get_service(service_id: str, user_id: str = Depends(get_current_user)):
    service = await db.services.find_one({"id": service_id, "user_id": user_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return parse_datetime_fields(service, ["created_at"])

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, update: ServiceUpdate, user_id: str = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.services.update_one({"id": service_id, "user_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    return parse_datetime_fields(service, ["created_at"])

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user_id: str = Depends(get_current_user)):
    result = await db.services.delete_one({"id": service_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}

# ==================== ITEM ROUTES ====================

@api_router.post("/items", response_model=Item)
async def create_item(item: ItemCreate, user_id: str = Depends(get_current_user)):
    new_item = Item(user_id=user_id, **item.model_dump())
    item_doc = prepare_doc_for_mongo(new_item.model_dump())
    await db.items.insert_one(item_doc)
    return new_item

@api_router.get("/items", response_model=List[Item])
async def get_items(user_id: str = Depends(get_current_user)):
    items = await db.items.find({"user_id": user_id}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [parse_datetime_fields(i, ["created_at"]) for i in items]

@api_router.put("/items/{item_id}", response_model=Item)
async def update_item(item_id: str, update: ItemUpdate, user_id: str = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.items.update_one({"id": item_id, "user_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    return parse_datetime_fields(item, ["created_at"])

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, user_id: str = Depends(get_current_user)):
    result = await db.items.delete_one({"id": item_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# ==================== APPOINTMENT ROUTES ====================

async def auto_sync_appointments_to_google(user_id: str, appointment_ids: list):
    """Background task to sync appointments to Google Calendar"""
    try:
        credentials = await get_user_google_credentials(user_id)
        if not credentials:
            return  # User not connected to Google Calendar
        
        service = build('calendar', 'v3', credentials=credentials)
        
        for appt_id in appointment_ids:
            try:
                appointment = await db.appointments.find_one({"id": appt_id, "user_id": user_id}, {"_id": 0})
                if not appointment:
                    continue
                
                # Get client details
                client = await db.clients.find_one({"id": appointment.get("client_id")}, {"_id": 0})
                if client:
                    appointment["client_phone"] = client.get("phone", "")
                    appointment["client_address"] = client.get("address", "")
                
                event = build_calendar_event(appointment)
                google_event_id = appointment.get("google_event_id")
                
                if google_event_id:
                    # Update existing
                    service.events().update(
                        calendarId='primary',
                        eventId=google_event_id,
                        body=event
                    ).execute()
                else:
                    # Create new
                    result = service.events().insert(
                        calendarId='primary',
                        body=event
                    ).execute()
                    
                    await db.appointments.update_one(
                        {"id": appt_id},
                        {"$set": {"google_event_id": result.get("id")}}
                    )
                
                logger.info(f"Synced appointment {appt_id} to Google Calendar")
            except Exception as e:
                logger.error(f"Failed to sync appointment {appt_id}: {e}")
    except Exception as e:
        logger.error(f"Auto-sync error: {e}")

async def delete_from_google(user_id: str, google_event_id: str):
    """Background task to delete event from Google Calendar"""
    try:
        credentials = await get_user_google_credentials(user_id)
        if not credentials or not google_event_id:
            return
        
        service = build('calendar', 'v3', credentials=credentials)
        service.events().delete(calendarId='primary', eventId=google_event_id).execute()
        logger.info(f"Deleted Google Calendar event {google_event_id}")
    except Exception as e:
        logger.error(f"Failed to delete from Google Calendar: {e}")

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appt: AppointmentCreate, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    # Get client name
    client = await db.clients.find_one({"id": appt.client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Calculate total duration and price
    total_duration = 0
    total_price = 0.0
    appointment_pets = []
    
    for pet_data in appt.pets:
        apt_pet = AppointmentPet(
            pet_name=pet_data.pet_name,
            pet_id=pet_data.pet_id,
            services=pet_data.services,
            items=pet_data.items
        )
        appointment_pets.append(apt_pet)
        
        # Get services and calculate
        for service_id in pet_data.services:
            service = await db.services.find_one({"id": service_id, "user_id": user_id}, {"_id": 0})
            if service:
                total_duration += service.get("duration", 0)
                total_price += service.get("price", 0)
        
        # Get items and calculate
        for item_id in pet_data.items:
            item = await db.items.find_one({"id": item_id, "user_id": user_id}, {"_id": 0})
            if item:
                total_price += item.get("price", 0)
    
    # Default duration if no services selected
    if total_duration == 0:
        total_duration = 60
    
    # Generate recurring appointments (up to 1 year)
    appointments_to_create = []
    recurring_id = str(uuid.uuid4()) if appt.is_recurring else None
    
    if appt.is_recurring and appt.recurring_value and appt.recurring_unit:
        import pytz
        
        # Get the original datetime
        original_dt = appt.date_time
        
        # We assume user is in Australia/Sydney timezone for DST handling
        # Store the local time components to keep them consistent
        local_tz = pytz.timezone('Australia/Sydney')
        
        # Convert to local time to get the "intended" hour:minute
        if original_dt.tzinfo is None:
            original_dt = original_dt.replace(tzinfo=timezone.utc)
        local_dt = original_dt.astimezone(local_tz)
        target_hour = local_dt.hour
        target_minute = local_dt.minute
        
        # Calculate number of occurrences based on unit
        delta_days = {
            "day": appt.recurring_value,
            "week": appt.recurring_value * 7,
            "month": appt.recurring_value * 30,
            "year": appt.recurring_value * 365
        }
        days_between = delta_days.get(appt.recurring_unit, 7)
        
        # Generate appointments for 1 year
        current_local_date = local_dt.date()
        end_local_date = current_local_date + timedelta(days=365)
        
        while current_local_date < end_local_date:
            # Create datetime at the target local time for this date
            # This handles DST automatically - same local time, different UTC offset
            try:
                local_datetime = local_tz.localize(
                    datetime(current_local_date.year, current_local_date.month, current_local_date.day, 
                            target_hour, target_minute, 0),
                    is_dst=None
                )
            except pytz.exceptions.AmbiguousTimeError:
                # During DST transition, use the standard time
                local_datetime = local_tz.localize(
                    datetime(current_local_date.year, current_local_date.month, current_local_date.day, 
                            target_hour, target_minute, 0),
                    is_dst=False
                )
            except pytz.exceptions.NonExistentTimeError:
                # Time doesn't exist due to DST spring forward, skip an hour
                local_datetime = local_tz.localize(
                    datetime(current_local_date.year, current_local_date.month, current_local_date.day, 
                            target_hour + 1, target_minute, 0),
                    is_dst=True
                )
            
            # Convert to UTC for storage
            utc_datetime = local_datetime.astimezone(timezone.utc)
            end_time = utc_datetime + timedelta(minutes=total_duration)
            
            appointments_to_create.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "client_id": appt.client_id,
                "client_name": client["name"],
                "date_time": utc_datetime.isoformat().replace('+00:00', 'Z'),
                "end_time": end_time.isoformat().replace('+00:00', 'Z'),
                "notes": appt.notes,
                "status": "scheduled",
                "is_recurring": True,
                "recurring_value": appt.recurring_value,
                "recurring_unit": appt.recurring_unit,
                "recurring_id": recurring_id,
                "pets": [p.model_dump() for p in appointment_pets],
                "total_duration": total_duration,
                "total_price": total_price,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            current_local_date += timedelta(days=days_between)
    else:
        # Single appointment
        end_time = appt.date_time + timedelta(minutes=total_duration)
        new_appointment = Appointment(
            user_id=user_id,
            client_id=appt.client_id,
            client_name=client["name"],
            date_time=appt.date_time,
            end_time=end_time,
            notes=appt.notes,
            is_recurring=False,
            recurring_value=None,
            recurring_unit=None,
            recurring_id=None,
            pets=[p.model_dump() for p in appointment_pets],
            total_duration=total_duration,
            total_price=total_price
        )
        appt_doc = prepare_doc_for_mongo(new_appointment.model_dump())
        appt_doc["pets"] = [prepare_doc_for_mongo(p) if isinstance(p, dict) else p for p in appt_doc.get("pets", [])]
        appointments_to_create.append(appt_doc)
    
    # Insert all appointments
    if appointments_to_create:
        # Prepare all docs for mongo
        prepared_docs = []
        for doc in appointments_to_create:
            prepared_doc = prepare_doc_for_mongo(doc)
            prepared_doc["pets"] = [prepare_doc_for_mongo(p) if isinstance(p, dict) else p for p in prepared_doc.get("pets", [])]
            prepared_docs.append(prepared_doc)
        
        await db.appointments.insert_many(prepared_docs)
        
        # Trigger backup
        background_tasks.add_task(backup_collection_to_supabase, "appointments", user_id)
        # Send SMS notification if automated (only for first appointment)
        background_tasks.add_task(send_appointment_sms, user_id, prepared_docs[0], "appointment_booked")
        
        # Auto-sync to Google Calendar if connected
        background_tasks.add_task(auto_sync_appointments_to_google, user_id, [doc["id"] for doc in prepared_docs])
        
        # Return the first appointment
        return parse_datetime_fields(prepared_docs[0], ["date_time", "end_time", "created_at"])
    
    return new_appointment

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments(
    start_date: str = "",
    end_date: str = "",
    client_id: str = "",
    status: str = "",
    user_id: str = Depends(get_current_user)
):
    query = {"user_id": user_id}
    
    if start_date and end_date:
        query["date_time"] = {
            "$gte": start_date,
            "$lte": end_date
        }
    elif start_date:
        query["date_time"] = {"$gte": start_date}
    elif end_date:
        query["date_time"] = {"$lte": end_date}
    
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("date_time", 1).to_list(1000)
    return [parse_datetime_fields(a, ["date_time", "end_time", "created_at"]) for a in appointments]

@api_router.get("/appointments/{appointment_id}", response_model=Appointment)
async def get_appointment(appointment_id: str, user_id: str = Depends(get_current_user)):
    appt = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return parse_datetime_fields(appt, ["date_time", "end_time", "created_at"])

@api_router.put("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment(appointment_id: str, update: AppointmentUpdate, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    update_data = {}
    original_appt = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
    
    if not original_appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    sms_type = None
    
    # Determine if updating single or series
    update_series = update.update_series and original_appt.get("is_recurring") and original_appt.get("recurring_id")
    
    if update.date_time:
        update_data["date_time"] = update.date_time.isoformat()
        # Recalculate end time
        duration = original_appt.get("total_duration", 60)
        update_data["end_time"] = (update.date_time + timedelta(minutes=duration)).isoformat()
        sms_type = "appointment_rescheduled"
    
    if update.status:
        update_data["status"] = update.status
        # Track no-shows and send appropriate SMS
        if update.status == "no_show":
            await db.clients.update_one(
                {"id": original_appt["client_id"]},
                {
                    "$inc": {"no_show_count": 1},
                    "$set": {"last_no_show": datetime.now(timezone.utc).isoformat()}
                }
            )
            sms_type = "no_show"
        elif update.status == "cancelled":
            sms_type = "appointment_cancelled"
    
    if update.notes is not None:
        update_data["notes"] = update.notes
    
    if update.pets is not None:
        # Recalculate with new pets
        total_duration = 0
        total_price = 0.0
        appointment_pets = []
        
        for pet_data in update.pets:
            apt_pet = AppointmentPet(
                pet_name=pet_data.pet_name,
                pet_id=pet_data.pet_id,
                services=pet_data.services,
                items=pet_data.items
            )
            appointment_pets.append(apt_pet.model_dump())
            
            for service_id in pet_data.services:
                service = await db.services.find_one({"id": service_id, "user_id": user_id}, {"_id": 0})
                if service:
                    total_duration += service.get("duration", 0)
                    total_price += service.get("price", 0)
            
            for item_id in pet_data.items:
                item = await db.items.find_one({"id": item_id, "user_id": user_id}, {"_id": 0})
                if item:
                    total_price += item.get("price", 0)
        
        if total_duration == 0:
            total_duration = 60
        
        update_data["pets"] = appointment_pets
        update_data["total_duration"] = total_duration
        update_data["total_price"] = total_price
        
        if update.date_time:
            update_data["end_time"] = (update.date_time + timedelta(minutes=total_duration)).isoformat()
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Special case: Converting non-recurring to recurring OR updating recurring frequency
    if hasattr(update, 'is_recurring') and update.is_recurring:
        # Check if this is a new conversion OR a frequency change
        was_recurring = original_appt.get("is_recurring", False)
        frequency_changed = (was_recurring and 
                           hasattr(update, 'recurring_value') and 
                           hasattr(update, 'recurring_unit') and
                           (update.recurring_value != original_appt.get('recurring_value') or
                            update.recurring_unit != original_appt.get('recurring_unit')))
        
        if not was_recurring or frequency_changed:
            # Either new recurring or frequency changed - regenerate series
            if hasattr(update, 'recurring_value') and hasattr(update, 'recurring_unit'):
                recurring_id = original_appt.get('recurring_id') or str(uuid.uuid4())
                
                # If frequency changed, delete old future occurrences first
                if frequency_changed and recurring_id:
                    current_date_str = datetime.now(timezone.utc).isoformat()
                    await db.appointments.delete_many({
                        "user_id": user_id,
                        "recurring_id": recurring_id,
                        "date_time": {"$gt": original_appt["date_time"]},  # Delete future occurrences only
                        "id": {"$ne": appointment_id}  # Don't delete the current one being updated
                    })
                    logger.info(f"Deleted old future occurrences for recurring_id {recurring_id}")
                
                delta_map = {
                    "day": timedelta(days=update.recurring_value),
                    "week": timedelta(weeks=update.recurring_value),
                    "month": timedelta(days=update.recurring_value * 30),
                    "year": timedelta(days=update.recurring_value * 365)
                }
                delta = delta_map.get(update.recurring_unit, timedelta(weeks=1))
                
                # Update current appointment
                update_data["is_recurring"] = True
                update_data["recurring_value"] = update.recurring_value
                update_data["recurring_unit"] = update.recurring_unit
                update_data["recurring_id"] = recurring_id
                
                # Generate future occurrences
                # FIX: Use updated date_time if provided, otherwise use original
                # Always use original appointment's date_time for frequency changes
                # This ensures proper date progression for recurring appointments
                base_date = datetime.fromisoformat(original_appt["date_time"].replace('Z', '+00:00')) if isinstance(original_appt["date_time"], str) else original_appt["date_time"]
                
                # CRITICAL FIX: Start from NEXT occurrence after the base appointment
                current_date = base_date + delta
                end_date = base_date + timedelta(days=365)
                
                future_appointments = []
                while current_date < end_date:
                    end_time = current_date + timedelta(minutes=original_appt.get("total_duration", 60))
                    future_appointments.append({
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "client_id": original_appt["client_id"],
                        "client_name": original_appt["client_name"],
                        "date_time": current_date.isoformat(),
                        "end_time": end_time.isoformat(),
                        "notes": update_data.get("notes", original_appt.get("notes", "")),
                        "status": "scheduled",
                        "is_recurring": True,
                        "recurring_value": update.recurring_value,
                        "recurring_unit": update.recurring_unit,
                        "recurring_id": recurring_id,
                        "pets": original_appt.get("pets", []),
                        "total_duration": original_appt.get("total_duration", 60),
                        "total_price": original_appt.get("total_price", 0),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    current_date += delta
                
                # Insert future appointments
                if future_appointments:
                    prepared_docs = []
                    for doc in future_appointments:
                        prepared_doc = prepare_doc_for_mongo(doc)
                        prepared_doc["pets"] = [prepare_doc_for_mongo(p) if isinstance(p, dict) else p for p in prepared_doc.get("pets", [])]
                        prepared_docs.append(prepared_doc)
                    await db.appointments.insert_many(prepared_docs)
                    logger.info(f"Created {len(prepared_docs)} future recurring appointments for appointment {appointment_id}")
    
    # Update single or series
    if update_series and update.date_time:
        import pytz
        
        # Update all appointments with the same recurring_id
        # We need to reschedule to the new LOCAL time for each appointment date
        recurring_id = original_appt.get("recurring_id")
        current_date_str = datetime.now(timezone.utc).isoformat()
        
        local_tz = pytz.timezone('Australia/Sydney')
        
        # Parse the new datetime to get the target local time
        new_datetime = update.date_time
        if new_datetime.tzinfo is None:
            new_datetime = new_datetime.replace(tzinfo=timezone.utc)
        
        # Convert new time to local to get the intended local hour:minute
        new_local = new_datetime.astimezone(local_tz)
        target_hour = new_local.hour
        target_minute = new_local.minute
        
        logger.info(f"Recurring series update: target local time = {target_hour}:{target_minute}")
        
        # Get all future appointments in the series
        future_appts = await db.appointments.find({
            "user_id": user_id,
            "recurring_id": recurring_id,
            "date_time": {"$gte": current_date_str}
        }, {"_id": 0}).to_list(1000)
        
        # Update each appointment to have the same LOCAL time
        duration = original_appt.get("total_duration", 60)
        for appt in future_appts:
            appt_datetime_str = appt["date_time"]
            if isinstance(appt_datetime_str, str):
                if appt_datetime_str.endswith('Z'):
                    appt_datetime = datetime.fromisoformat(appt_datetime_str.replace('Z', '+00:00'))
                elif '+' in appt_datetime_str:
                    appt_datetime = datetime.fromisoformat(appt_datetime_str)
                else:
                    appt_datetime = datetime.fromisoformat(appt_datetime_str).replace(tzinfo=timezone.utc)
            else:
                appt_datetime = appt_datetime_str
            
            # Get the date portion in local timezone
            appt_local = appt_datetime.astimezone(local_tz)
            appt_date = appt_local.date()
            
            # Create new datetime at the target local time for this date
            try:
                new_local_datetime = local_tz.localize(
                    datetime(appt_date.year, appt_date.month, appt_date.day, target_hour, target_minute, 0),
                    is_dst=None
                )
            except pytz.exceptions.AmbiguousTimeError:
                new_local_datetime = local_tz.localize(
                    datetime(appt_date.year, appt_date.month, appt_date.day, target_hour, target_minute, 0),
                    is_dst=False
                )
            except pytz.exceptions.NonExistentTimeError:
                new_local_datetime = local_tz.localize(
                    datetime(appt_date.year, appt_date.month, appt_date.day, target_hour + 1, target_minute, 0),
                    is_dst=True
                )
            
            # Convert to UTC for storage
            new_appt_utc = new_local_datetime.astimezone(timezone.utc)
            new_end_time = new_appt_utc + timedelta(minutes=duration)
            
            await db.appointments.update_one(
                {"id": appt["id"], "user_id": user_id},
                {"$set": {
                    "date_time": new_appt_utc.isoformat().replace('+00:00', 'Z'),
                    "end_time": new_end_time.isoformat().replace('+00:00', 'Z')
                }}
            )
        
        logger.info(f"Updated {len(future_appts)} appointments in series to local time {target_hour}:{target_minute}")
        
        # Return the updated appointment
        appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found after update")
        return parse_datetime_fields(appt, ["date_time", "end_time", "created_at"])
        
    elif update_series:
        appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found after update")
        return parse_datetime_fields(appt, ["date_time", "end_time", "created_at"])
        
    elif update_series:
        # Update all appointments with the same recurring_id (no date change)
        recurring_id = original_appt.get("recurring_id")
        current_date = datetime.now(timezone.utc).isoformat()
        
        # CRITICAL FIX: When updating series without frequency change, preserve recurring fields
        if original_appt.get("is_recurring") and "is_recurring" not in update_data:
            update_data["is_recurring"] = original_appt.get("is_recurring")
            update_data["recurring_value"] = original_appt.get("recurring_value")
            update_data["recurring_unit"] = original_appt.get("recurring_unit")
            update_data["recurring_id"] = recurring_id
        
        result = await db.appointments.update_many(
            {
                "user_id": user_id,
                "recurring_id": recurring_id,
                "date_time": {"$gte": current_date}
            },
            {"$set": update_data}
        )
    else:
        # Update single appointment
        # If this is a recurring appointment and we're updating just this one occurrence,
        # we need to "detach" it from the series by removing recurring fields and giving it independence
        if original_appt.get("is_recurring") and original_appt.get("recurring_id"):
            # Detach from series: remove recurring metadata so it becomes a standalone appointment
            update_data["is_recurring"] = False
            update_data["recurring_value"] = None
            update_data["recurring_unit"] = None
            update_data["recurring_id"] = None
            logger.info(f"Detaching appointment {appointment_id} from recurring series")
        
        # Re-verify appointment exists before update
        check_exists = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
        if not check_exists:
            logger.error(f"Appointment {appointment_id} not found during update operation")
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        result = await db.appointments.update_one(
            {"id": appointment_id, "user_id": user_id},
            {"$set": update_data}
        )
        logger.info(f"Updated appointment {appointment_id} with data: {update_data}")
    
    if result.matched_count == 0:
        logger.error(f"No appointments matched for update. ID: {appointment_id}, update_series: {update_series}")
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appt:
        logger.error(f"Appointment {appointment_id} not found after update")
        raise HTTPException(status_code=404, detail="Appointment not found after update")
    
    # Send SMS if status changed to something notable
    if sms_type:
        background_tasks.add_task(send_appointment_sms, user_id, appt, sms_type)
    
    # Auto-sync to Google Calendar
    background_tasks.add_task(auto_sync_appointments_to_google, user_id, [appointment_id])
    
    return parse_datetime_fields(appt, ["date_time", "end_time", "created_at"])

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, delete_series: bool = False, background_tasks: BackgroundTasks = None, user_id: str = Depends(get_current_user)):
    appt = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
    
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Delete series or single
    if delete_series and appt.get("is_recurring") and appt.get("recurring_id"):
        recurring_id = appt.get("recurring_id")
        
        # Get all appointments in series to delete from Google Calendar
        series_appts = await db.appointments.find(
            {"user_id": user_id, "recurring_id": recurring_id},
            {"_id": 0, "google_event_id": 1}
        ).to_list(500)
        
        # Delete from Google Calendar
        if background_tasks:
            for sa in series_appts:
                if sa.get("google_event_id"):
                    background_tasks.add_task(delete_from_google, user_id, sa["google_event_id"])
        
        # Delete ALL appointments with the same recurring_id (entire series)
        result = await db.appointments.delete_many({
            "user_id": user_id,
            "recurring_id": recurring_id
        })
        logger.info(f"Deleted {result.deleted_count} appointments with recurring_id {recurring_id}")
        return {"message": f"Deleted {result.deleted_count} appointments in series"}
    else:
        # Delete from Google Calendar
        if background_tasks and appt.get("google_event_id"):
            background_tasks.add_task(delete_from_google, user_id, appt["google_event_id"])
        
        result = await db.appointments.delete_one({"id": appointment_id, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return {"message": "Appointment deleted"}

# ==================== WAITLIST ROUTES ====================

@api_router.post("/waitlist", response_model=Waitlist)
async def create_waitlist(entry: WaitlistCreate, user_id: str = Depends(get_current_user)):
    # Get client name
    client = await db.clients.find_one({"id": entry.client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    new_entry = Waitlist(
        user_id=user_id,
        client_id=entry.client_id,
        client_name=client["name"],
        preferred_date=entry.preferred_date,
        preferred_timeframe=entry.preferred_timeframe,
        preferred_pets=entry.preferred_pets,
        preferred_services=entry.preferred_services,
        notes=entry.notes
    )
    entry_doc = prepare_doc_for_mongo(new_entry.model_dump())
    await db.waitlist.insert_one(entry_doc)
    return new_entry

@api_router.get("/waitlist", response_model=List[Waitlist])
async def get_waitlist(user_id: str = Depends(get_current_user)):
    entries = await db.waitlist.find({"user_id": user_id}, {"_id": 0}).sort("date_added", 1).to_list(1000)
    return [parse_datetime_fields(e, ["date_added"]) for e in entries]

@api_router.put("/waitlist/{waitlist_id}", response_model=Waitlist)
async def update_waitlist(waitlist_id: str, update: WaitlistUpdate, user_id: str = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.waitlist.update_one({"id": waitlist_id, "user_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    
    entry = await db.waitlist.find_one({"id": waitlist_id}, {"_id": 0})
    return parse_datetime_fields(entry, ["date_added"])

@api_router.delete("/waitlist/{waitlist_id}")
async def delete_waitlist(waitlist_id: str, user_id: str = Depends(get_current_user)):
    result = await db.waitlist.delete_one({"id": waitlist_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")
    return {"message": "Waitlist entry deleted"}

# ==================== RECURRING TEMPLATE ROUTES ====================

@api_router.post("/recurring-templates", response_model=RecurringTemplate)
async def create_recurring_template(template: RecurringTemplateCreate, user_id: str = Depends(get_current_user)):
    # Get client name
    client = await db.clients.find_one({"id": template.client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    pets_services = []
    for pet_data in template.pets_services:
        apt_pet = AppointmentPet(
            pet_name=pet_data.pet_name,
            pet_id=pet_data.pet_id,
            services=pet_data.services,
            items=pet_data.items
        )
        pets_services.append(apt_pet)
    
    new_template = RecurringTemplate(
        user_id=user_id,
        client_id=template.client_id,
        client_name=client["name"],
        frequency=template.frequency,
        time=template.time,
        day_of_week=template.day_of_week,
        pets_services=[p.model_dump() for p in pets_services]
    )
    template_doc = prepare_doc_for_mongo(new_template.model_dump())
    await db.recurring_templates.insert_one(template_doc)
    return new_template

@api_router.get("/recurring-templates", response_model=List[RecurringTemplate])
async def get_recurring_templates(user_id: str = Depends(get_current_user)):
    templates = await db.recurring_templates.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return [parse_datetime_fields(t, ["created_at"]) for t in templates]

@api_router.put("/recurring-templates/{template_id}")
async def toggle_recurring_template(template_id: str, active: bool, user_id: str = Depends(get_current_user)):
    result = await db.recurring_templates.update_one(
        {"id": template_id, "user_id": user_id},
        {"$set": {"active": active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated"}

@api_router.delete("/recurring-templates/{template_id}")
async def delete_recurring_template(template_id: str, user_id: str = Depends(get_current_user)):
    result = await db.recurring_templates.delete_one({"id": template_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user_id: str = Depends(get_current_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today.isoformat()
    tomorrow_str = (today + timedelta(days=1)).isoformat()
    
    # Today's appointments
    today_appointments = await db.appointments.count_documents({
        "user_id": user_id,
        "date_time": {"$gte": today_str, "$lt": tomorrow_str}
    })
    
    # This week's appointments
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    week_appointments = await db.appointments.count_documents({
        "user_id": user_id,
        "date_time": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
    })
    
    # Total clients
    total_clients = await db.clients.count_documents({"user_id": user_id})
    
    # Waitlist count
    waitlist_count = await db.waitlist.count_documents({"user_id": user_id})
    
    return {
        "today_appointments": today_appointments,
        "week_appointments": week_appointments,
        "total_clients": total_clients,
        "waitlist_count": waitlist_count
    }

# ==================== INVOICE ROUTES ====================

async def generate_invoice_number(user_id: str) -> str:
    """Generate unique invoice number"""
    # Get the highest invoice number for this user this month
    now = datetime.now(timezone.utc)
    month_prefix = f"INV-{now.strftime('%Y%m')}-"
    
    # Find the highest number for this month
    latest = await db.invoices.find_one(
        {"user_id": user_id, "invoice_number": {"$regex": f"^{month_prefix}"}},
        {"invoice_number": 1, "_id": 0},
        sort=[("invoice_number", -1)]
    )
    
    if latest:
        # Extract the number part and increment
        try:
            last_num = int(latest["invoice_number"].split("-")[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    
    return f"{month_prefix}{str(next_num).zfill(4)}"

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceCreate, user_id: str = Depends(get_current_user)):
    """Create a new invoice"""
    # Get client info
    client = await db.clients.find_one({"id": invoice_data.client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get user settings for GST
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    gst_enabled = settings.get("gst_enabled", False) if settings else False
    gst_rate = settings.get("gst_rate", 10) if settings else 10
    
    # Calculate totals - prices INCLUDE GST
    items_total = sum(item.total for item in invoice_data.items)
    discount = invoice_data.discount or 0
    total_after_discount = max(0, items_total - discount)
    
    # GST is included: if 10% GST, then GST = total * 10/110
    gst_amount = (total_after_discount * gst_rate / (100 + gst_rate)) if gst_enabled else 0
    subtotal = total_after_discount - gst_amount
    
    # Generate invoice number
    invoice_number = await generate_invoice_number(user_id)
    
    new_invoice = Invoice(
        invoice_number=invoice_number,
        user_id=user_id,
        appointment_id=invoice_data.appointment_id,
        client_id=invoice_data.client_id,
        client_name=client.get("name", ""),
        client_email=client.get("email", ""),
        client_phone=client.get("phone", ""),
        client_address=client.get("address", ""),
        items=[item.model_dump() for item in invoice_data.items],
        subtotal=subtotal,
        discount=discount,
        gst_amount=gst_amount,
        total=total_after_discount,
        notes=invoice_data.notes,
        due_date=invoice_data.due_date.isoformat() if invoice_data.due_date else None
    )
    
    invoice_doc = prepare_doc_for_mongo(new_invoice.model_dump())
    await db.invoices.insert_one(invoice_doc)
    
    return new_invoice

@api_router.post("/invoices/from-appointment/{appointment_id}", response_model=Invoice)
async def create_invoice_from_appointment(appointment_id: str, user_id: str = Depends(get_current_user)):
    """Create invoice from an appointment, or return existing one"""
    # Check if invoice already exists for this appointment
    existing_invoice = await db.invoices.find_one({"appointment_id": appointment_id, "user_id": user_id}, {"_id": 0})
    if existing_invoice:
        return existing_invoice
    
    # Get appointment
    appointment = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Get client
    client = await db.clients.find_one({"id": appointment["client_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get settings
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    gst_enabled = settings.get("gst_enabled", False) if settings else False
    gst_rate = settings.get("gst_rate", 10) if settings else 10
    
    # Build items from appointment services/items
    items = []
    for pet in appointment.get("pets", []):
        pet_name = pet.get("pet_name", "Pet")
        
        # Add services
        for service_id in pet.get("services", []):
            service = await db.services.find_one({"id": service_id}, {"_id": 0})
            if service:
                items.append({
                    "name": f"{service['name']} - {pet_name}",
                    "quantity": 1,
                    "unit_price": service.get("price", 0),
                    "total": service.get("price", 0)
                })
        
        # Add items
        for item_id in pet.get("items", []):
            item = await db.items.find_one({"id": item_id}, {"_id": 0})
            if item:
                items.append({
                    "name": item["name"],
                    "quantity": 1,
                    "unit_price": item.get("price", 0),
                    "total": item.get("price", 0)
                })
    
    # Calculate totals - prices INCLUDE GST
    total_amount = sum(item["total"] for item in items)
    
    # GST is included in prices: if 10% GST, then GST = total * 10/110
    gst_amount = (total_amount * gst_rate / (100 + gst_rate)) if gst_enabled else 0
    subtotal = total_amount - gst_amount
    
    # Generate invoice number
    invoice_number = await generate_invoice_number(user_id)
    
    new_invoice = Invoice(
        invoice_number=invoice_number,
        user_id=user_id,
        appointment_id=appointment_id,
        client_id=appointment["client_id"],
        client_name=client.get("name", ""),
        client_email=client.get("email", ""),
        client_phone=client.get("phone", ""),
        client_address=client.get("address", ""),
        items=items,
        subtotal=subtotal,
        gst_amount=gst_amount,
        total=total_amount
    )
    
    invoice_doc = prepare_doc_for_mongo(new_invoice.model_dump())
    await db.invoices.insert_one(invoice_doc)
    
    return new_invoice

@api_router.get("/invoices/check/{appointment_id}")
async def check_invoice_exists(appointment_id: str, user_id: str = Depends(get_current_user)):
    """Check if an invoice already exists for an appointment"""
    existing_invoice = await db.invoices.find_one(
        {"appointment_id": appointment_id, "user_id": user_id}, 
        {"_id": 0, "id": 1, "invoice_number": 1}
    )
    if existing_invoice:
        return {"has_invoice": True, "invoice_id": existing_invoice["id"], "invoice_number": existing_invoice["invoice_number"]}
    return {"has_invoice": False, "invoice_id": None, "invoice_number": None}

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(
    client_id: str = "",
    status: str = "",
    limit: int = 100,
    user_id: str = Depends(get_current_user)
):
    """Get all invoices"""
    query = {"user_id": user_id}
    if client_id:
        query["client_id"] = client_id
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [parse_datetime_fields(inv, ["created_at"]) for inv in invoices]

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, user_id: str = Depends(get_current_user)):
    """Get a single invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id, "user_id": user_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return parse_datetime_fields(invoice, ["created_at"])

@api_router.get("/invoices/by-number/{invoice_number}")
async def get_invoice_by_number(invoice_number: str, user_id: str = Depends(get_current_user)):
    """Get invoice by invoice number"""
    invoice = await db.invoices.find_one({"invoice_number": invoice_number, "user_id": user_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get business settings for invoice display
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "invoice": parse_datetime_fields(invoice, ["created_at"]),
        "business": {
            "name": settings.get("business_name", "") if settings else "",
            "abn": settings.get("abn", "") if settings else "",
            "phone": settings.get("phone", "") if settings else "",
            "email": settings.get("email", "") if settings else "",
            "address": settings.get("address", "") if settings else "",
            "pay_id": settings.get("pay_id", "") if settings else "",
            "bank_name": settings.get("bank_name", "") if settings else "",
            "bsb": settings.get("bsb", "") if settings else "",
            "account_number": settings.get("account_number", "") if settings else "",
            "account_name": settings.get("account_name", "") if settings else "",
            "gst_enabled": settings.get("gst_enabled", False) if settings else False
        }
    }

@api_router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, update: InvoiceUpdate, user_id: str = Depends(get_current_user)):
    """Update an invoice"""
    update_data = {}
    
    if update.items is not None:
        # Recalculate totals - prices INCLUDE GST
        settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
        gst_enabled = settings.get("gst_enabled", False) if settings else False
        gst_rate = settings.get("gst_rate", 10) if settings else 10
        
        items = [item.model_dump() for item in update.items]
        total_amount = sum(item["total"] for item in items)
        
        # GST is included: if 10% GST, then GST = total * 10/110
        gst_amount = (total_amount * gst_rate / (100 + gst_rate)) if gst_enabled else 0
        subtotal = total_amount - gst_amount
        
        update_data["items"] = items
        update_data["subtotal"] = subtotal
        update_data["gst_amount"] = gst_amount
        update_data["total"] = total_amount
    
    if update.notes is not None:
        update_data["notes"] = update.notes
    if update.status is not None:
        update_data["status"] = update.status
    if update.due_date is not None:
        update_data["due_date"] = update.due_date.isoformat()
    if update.paid_date is not None:
        update_data["paid_date"] = update.paid_date.isoformat()
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.invoices.update_one(
        {"id": invoice_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return parse_datetime_fields(invoice, ["created_at"])

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user_id: str = Depends(get_current_user)):
    """Delete an invoice"""
    result = await db.invoices.delete_one({"id": invoice_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted"}

# ==================== SMS FUNCTIONS ====================

async def get_user_settings(user_id: str) -> dict:
    """Get user settings from database"""
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    if not settings:
        return {}
    return settings

def format_sms_template(template: str, variables: dict) -> str:
    """Replace template variables with actual values"""
    message = template
    for key, value in variables.items():
        message = message.replace(f"{{{key}}}", str(value))
    return message

async def send_twilio_sms(to_phone: str, message: str, settings: dict) -> tuple:
    """Send SMS via Twilio"""
    try:
        from twilio.rest import Client as TwilioClient
        
        account_sid = settings.get("twilio_account_sid")
        auth_token = settings.get("twilio_auth_token")
        from_phone = settings.get("twilio_phone_number")
        
        if not all([account_sid, auth_token, from_phone]):
            return False, "Twilio credentials not configured"
        
        client = TwilioClient(account_sid, auth_token)
        
        # Ensure Australian format
        if not to_phone.startswith("+"):
            to_phone = "+61" + to_phone.lstrip("0")
        
        message_obj = client.messages.create(
            body=message,
            from_=from_phone,
            to=to_phone
        )
        
        return True, message_obj.sid
    except Exception as e:
        logger.error(f"Twilio SMS error: {e}")
        return False, str(e)

async def create_sms_log(user_id: str, client_id: str, client_name: str, phone: str, 
                         message_type: str, message_text: str, appointment_id: str = None,
                         status: str = "pending", error_message: str = None) -> str:
    """Create SMS message log entry"""
    sms_log = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "client_id": client_id,
        "client_name": client_name,
        "phone": phone,
        "message_type": message_type,
        "message_text": message_text,
        "status": status,
        "appointment_id": appointment_id,
        "error_message": error_message,
        "sent_at": datetime.now(timezone.utc).isoformat() if status == "sent" else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sms_messages.insert_one(sms_log)
    return sms_log["id"]

async def send_appointment_sms(user_id: str, appointment: dict, message_type: str):
    """Send SMS for appointment events (if automated mode is enabled)"""
    try:
        settings = await get_user_settings(user_id)
        
        if not settings.get("sms_enabled"):
            return
        
        if settings.get("sms_mode") != "automated":
            return
        
        templates = settings.get("sms_templates", DEFAULT_SMS_TEMPLATES)
        template_config = templates.get(message_type)
        
        if not template_config or not template_config.get("enabled"):
            return
        
        # Get client info
        client = await db.clients.find_one({"id": appointment["client_id"]}, {"_id": 0})
        if not client or not client.get("phone"):
            return
        
        # Format message
        appt_date = datetime.fromisoformat(appointment["date_time"].replace("Z", "+00:00"))
        pet_names = ", ".join([p.get("pet_name", "") for p in appointment.get("pets", [])])
        
        variables = {
            "client_name": client.get("name", ""),
            "pet_names": pet_names or "your pet",
            "business_name": settings.get("business_name", "our salon"),
            "business_phone": settings.get("phone", ""),
            "date": appt_date.strftime("%A, %B %d"),
            "time": appt_date.strftime("%I:%M %p") if not settings.get("use_24_hour_clock") else appt_date.strftime("%H:%M")
        }
        
        message = format_sms_template(template_config["template"], variables)
        
        # Send via Twilio if configured
        if settings.get("sms_provider") == "twilio":
            success, result = await send_twilio_sms(client["phone"], message, settings)
            status = "sent" if success else "failed"
            error = None if success else result
        else:
            # Manual/native mode - just log it for user to send manually
            status = "pending"
            error = None
        
        await create_sms_log(
            user_id=user_id,
            client_id=client["id"],
            client_name=client["name"],
            phone=client["phone"],
            message_type=message_type,
            message_text=message,
            appointment_id=appointment.get("id"),
            status=status,
            error_message=error
        )
        
    except Exception as e:
        logger.error(f"Error sending appointment SMS: {e}")

# ==================== AUTOMATED REMINDER SYSTEM ====================

async def check_and_send_reminders():
    """Check for upcoming appointments and send reminders"""
    try:
        logger.info("Running automated reminder check...")
        
        # Get all users with SMS enabled
        users_with_sms = await db.settings.find(
            {"sms_enabled": True, "sms_mode": "automated"},
            {"_id": 0, "user_id": 1, "send_24h_reminder": 1, "reminder_value": 1, 
             "reminder_unit": 1, "send_confirmation_request": 1, 
             "confirmation_request_value": 1, "confirmation_request_unit": 1}
        ).to_list(None)
        
        now = datetime.now(timezone.utc)
        
        for user_settings in users_with_sms:
            user_id = user_settings.get("user_id")
            if not user_id:
                continue
            
            # Get full settings for this user
            full_settings = await get_user_settings(user_id)
            
            # Check 24h reminder
            if user_settings.get("send_24h_reminder", True):
                reminder_value = user_settings.get("reminder_value", 24)
                reminder_unit = user_settings.get("reminder_unit", "hours")
                
                # Calculate the reminder window
                if reminder_unit == "hours":
                    reminder_delta = timedelta(hours=reminder_value)
                else:  # days
                    reminder_delta = timedelta(days=reminder_value)
                
                # Find appointments that need 24h reminder
                # Window: appointments between (now + reminder_delta - 30min) and (now + reminder_delta + 30min)
                window_start = now + reminder_delta - timedelta(minutes=30)
                window_end = now + reminder_delta + timedelta(minutes=30)
                
                appointments_for_reminder = await db.appointments.find({
                    "user_id": user_id,
                    "status": "scheduled",
                    "date_time": {
                        "$gte": window_start.isoformat(),
                        "$lte": window_end.isoformat()
                    },
                    "reminder_24h_sent": {"$ne": True}
                }, {"_id": 0}).to_list(None)
                
                for appt in appointments_for_reminder:
                    try:
                        await send_reminder_sms(user_id, appt, "reminder_24h", full_settings)
                        # Mark as sent
                        await db.appointments.update_one(
                            {"id": appt["id"]},
                            {"$set": {"reminder_24h_sent": True}}
                        )
                        logger.info(f"Sent 24h reminder for appointment {appt['id']}")
                    except Exception as e:
                        logger.error(f"Failed to send 24h reminder for {appt['id']}: {e}")
            
            # Check confirmation request (e.g., 2 days before)
            if user_settings.get("send_confirmation_request", True):
                conf_value = user_settings.get("confirmation_request_value", 2)
                conf_unit = user_settings.get("confirmation_request_unit", "days")
                
                # Calculate the confirmation window
                if conf_unit == "days":
                    conf_delta = timedelta(days=conf_value)
                elif conf_unit == "weeks":
                    conf_delta = timedelta(weeks=conf_value)
                else:  # months (approx 30 days)
                    conf_delta = timedelta(days=conf_value * 30)
                
                # Window: appointments between (now + conf_delta - 30min) and (now + conf_delta + 30min)
                window_start = now + conf_delta - timedelta(minutes=30)
                window_end = now + conf_delta + timedelta(minutes=30)
                
                appointments_for_confirmation = await db.appointments.find({
                    "user_id": user_id,
                    "status": "scheduled",
                    "date_time": {
                        "$gte": window_start.isoformat(),
                        "$lte": window_end.isoformat()
                    },
                    "confirmation_sent": {"$ne": True}
                }, {"_id": 0}).to_list(None)
                
                for appt in appointments_for_confirmation:
                    try:
                        await send_reminder_sms(user_id, appt, "confirmation_request", full_settings)
                        # Mark as sent
                        await db.appointments.update_one(
                            {"id": appt["id"]},
                            {"$set": {"confirmation_sent": True}}
                        )
                        logger.info(f"Sent confirmation request for appointment {appt['id']}")
                    except Exception as e:
                        logger.error(f"Failed to send confirmation for {appt['id']}: {e}")
        
        logger.info("Reminder check completed")
        
    except Exception as e:
        logger.error(f"Error in reminder check: {e}")

async def send_reminder_sms(user_id: str, appointment: dict, message_type: str, settings: dict):
    """Send a reminder SMS for an appointment"""
    try:
        templates = settings.get("sms_templates", DEFAULT_SMS_TEMPLATES)
        template_config = templates.get(message_type)
        
        if not template_config or not template_config.get("enabled"):
            logger.info(f"Template {message_type} is disabled, skipping")
            return
        
        # Get client info
        client_doc = await db.clients.find_one({"id": appointment["client_id"]}, {"_id": 0})
        if not client_doc or not client_doc.get("phone"):
            logger.warning(f"Client {appointment['client_id']} has no phone, skipping reminder")
            return
        
        # Format message
        appt_date_str = appointment["date_time"]
        if isinstance(appt_date_str, str):
            appt_date = datetime.fromisoformat(appt_date_str.replace("Z", "+00:00"))
        else:
            appt_date = appt_date_str
            
        pet_names = ", ".join([p.get("pet_name", "") for p in appointment.get("pets", [])])
        
        variables = {
            "client_name": client_doc.get("name", ""),
            "pet_names": pet_names or "your pet",
            "business_name": settings.get("business_name", "our salon"),
            "business_phone": settings.get("phone", ""),
            "date": appt_date.strftime("%A, %B %d"),
            "time": appt_date.strftime("%I:%M %p") if not settings.get("use_24_hour_clock") else appt_date.strftime("%H:%M")
        }
        
        message = format_sms_template(template_config["template"], variables)
        
        # Send via Twilio if configured
        if settings.get("sms_provider") == "twilio":
            success, result = await send_twilio_sms(client_doc["phone"], message, settings)
            status = "sent" if success else "failed"
            error = None if success else result
        else:
            # Manual/native mode - just log it
            status = "pending"
            error = None
        
        await create_sms_log(
            user_id=user_id,
            client_id=client_doc["id"],
            client_name=client_doc["name"],
            phone=client_doc["phone"],
            message_type=message_type,
            message_text=message,
            appointment_id=appointment.get("id"),
            status=status,
            error_message=error
        )
        
    except Exception as e:
        logger.error(f"Error sending reminder SMS: {e}")
        raise

# Initialize the scheduler
scheduler = AsyncIOScheduler()

def start_reminder_scheduler():
    """Start the background scheduler for reminders"""
    # Run every 15 minutes
    scheduler.add_job(
        check_and_send_reminders,
        IntervalTrigger(minutes=15),
        id="reminder_check",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Reminder scheduler started - checking every 15 minutes")

# ==================== SMS ROUTES ====================

@api_router.get("/sms/templates")
async def get_sms_templates(user_id: str = Depends(get_current_user)):
    """Get SMS templates for user"""
    settings = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    if not settings:
        return {"templates": DEFAULT_SMS_TEMPLATES}
    return {"templates": settings.get("sms_templates", DEFAULT_SMS_TEMPLATES)}

@api_router.put("/sms/templates")
async def update_sms_templates(templates: dict, user_id: str = Depends(get_current_user)):
    """Update SMS templates"""
    await db.settings.update_one(
        {"user_id": user_id},
        {"$set": {"sms_templates": templates, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Templates updated"}

@api_router.post("/sms/send")
async def send_sms(request: SendSMSRequest, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    """Send SMS to a client (manual trigger)"""
    settings = await get_user_settings(user_id)
    
    if not settings.get("sms_enabled"):
        raise HTTPException(status_code=400, detail="SMS is not enabled")
    
    # Get client
    client = await db.clients.find_one({"id": request.client_id, "user_id": user_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if not client.get("phone"):
        raise HTTPException(status_code=400, detail="Client has no phone number")
    
    # Get appointment if provided
    appointment = None
    if request.appointment_id:
        appointment = await db.appointments.find_one({"id": request.appointment_id}, {"_id": 0})
    
    # Format message
    if request.custom_message:
        message = request.custom_message
    else:
        templates = settings.get("sms_templates", DEFAULT_SMS_TEMPLATES)
        template_config = templates.get(request.message_type)
        
        if not template_config:
            raise HTTPException(status_code=400, detail="Invalid message type")
        
        if appointment:
            appt_date = datetime.fromisoformat(appointment["date_time"].replace("Z", "+00:00"))
            pet_names = ", ".join([p.get("pet_name", "") for p in appointment.get("pets", [])])
        else:
            appt_date = datetime.now(timezone.utc)
            pet_names = "your pet"
        
        variables = {
            "client_name": client.get("name", ""),
            "pet_names": pet_names,
            "business_name": settings.get("business_name", "our salon"),
            "business_phone": settings.get("phone", ""),
            "date": appt_date.strftime("%A, %B %d"),
            "time": appt_date.strftime("%I:%M %p") if not settings.get("use_24_hour_clock") else appt_date.strftime("%H:%M")
        }
        
        message = format_sms_template(template_config["template"], variables)
    
    # Send or log
    if settings.get("sms_provider") == "twilio":
        success, result = await send_twilio_sms(client["phone"], message, settings)
        status = "sent" if success else "failed"
        error = None if success else result
    else:
        # For native/manual - return message for user to copy
        status = "pending"
        error = None
    
    log_id = await create_sms_log(
        user_id=user_id,
        client_id=client["id"],
        client_name=client["name"],
        phone=client["phone"],
        message_type=request.message_type,
        message_text=message,
        appointment_id=request.appointment_id,
        status=status,
        error_message=error
    )
    
    return {
        "id": log_id,
        "status": status,
        "message": message,
        "phone": client["phone"],
        "error": error
    }

@api_router.get("/sms/messages")
async def get_sms_messages(client_id: str = "", limit: int = 50, user_id: str = Depends(get_current_user)):
    """Get SMS message history"""
    query = {"user_id": user_id}
    if client_id:
        query["client_id"] = client_id
    
    messages = await db.sms_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return messages

@api_router.put("/sms/messages/{message_id}/status")
async def update_sms_status(message_id: str, status: str, user_id: str = Depends(get_current_user)):
    """Update SMS message status (for manual sends)"""
    result = await db.sms_messages.update_one(
        {"id": message_id, "user_id": user_id},
        {"$set": {"status": status, "sent_at": datetime.now(timezone.utc).isoformat() if status == "sent" else None}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Status updated"}

@api_router.post("/sms/preview")
async def preview_sms(message_type: str, appointment_id: str = None, user_id: str = Depends(get_current_user)):
    """Preview an SMS message without sending"""
    settings = await get_user_settings(user_id)
    templates = settings.get("sms_templates", DEFAULT_SMS_TEMPLATES)
    template_config = templates.get(message_type)
    
    if not template_config:
        raise HTTPException(status_code=400, detail="Invalid message type")
    
    # Get sample data
    if appointment_id:
        appointment = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
        if appointment:
            client = await db.clients.find_one({"id": appointment["client_id"]}, {"_id": 0})
            appt_date = datetime.fromisoformat(appointment["date_time"].replace("Z", "+00:00"))
            pet_names = ", ".join([p.get("pet_name", "") for p in appointment.get("pets", [])])
        else:
            client = {"name": "Sample Client"}
            appt_date = datetime.now(timezone.utc)
            pet_names = "Buddy"
    else:
        client = {"name": "Sample Client"}
        appt_date = datetime.now(timezone.utc)
        pet_names = "Buddy"
    
    variables = {
        "client_name": client.get("name", "Sample Client"),
        "pet_names": pet_names or "Buddy",
        "business_name": settings.get("business_name", "Your Business"),
        "business_phone": settings.get("phone", "0400 000 000"),
        "date": appt_date.strftime("%A, %B %d"),
        "time": appt_date.strftime("%I:%M %p") if not settings.get("use_24_hour_clock") else appt_date.strftime("%H:%M")
    }
    
    message = format_sms_template(template_config["template"], variables)
    
    return {
        "template": template_config["template"],
        "preview": message,
        "variables": variables,
        "char_count": len(message)
    }

# ==================== BACKUP FUNCTIONS ====================

async def backup_collection_to_supabase(collection_name: str, user_id: str):
    """Backup a MongoDB collection to Supabase for a specific user"""
    if not supabase_client:
        return
    
    try:
        # Fetch all documents for this user
        docs = await db[collection_name].find({"user_id": user_id}, {"_id": 0}).to_list(10000)
        
        if not docs:
            return
        
        backup_data = {
            "id": f"{user_id}_{collection_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            "user_id": user_id,
            "collection": collection_name,
            "data": docs,
            "backup_at": datetime.now(timezone.utc).isoformat(),
            "count": len(docs)
        }
        
        # Upsert to Supabase
        supabase_client.table("maya_backups").upsert(backup_data).execute()
        logger.info(f"Backed up {len(docs)} documents from {collection_name} for user {user_id}")
    except Exception as e:
        logger.error(f"Backup failed for {collection_name}: {e}")

async def backup_user_data(user_id: str):
    """Backup all data for a user"""
    collections = ["clients", "pets", "services", "items", "appointments", "waitlist", "recurring_templates", "settings"]
    for collection in collections:
        await backup_collection_to_supabase(collection, user_id)

def trigger_backup(user_id: str):
    """Trigger async backup in background"""
    if supabase_client:
        asyncio.create_task(backup_user_data(user_id))

# ==================== ROOT ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "Maya Groom Pro API", "version": "1.0.0"}

@api_router.post("/backup")
async def trigger_manual_backup(background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    """Manually trigger a backup of all user data"""
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Backup service not configured")
    
    background_tasks.add_task(backup_user_data, user_id)
    return {"message": "Backup started", "status": "processing"}

@api_router.get("/backup/status")
async def get_backup_status(user_id: str = Depends(get_current_user)):
    """Get the latest backup status"""
    if not supabase_client:
        return {"status": "not_configured"}
    
    try:
        result = supabase_client.table("maya_backups").select("*").eq("user_id", user_id).order("backup_at", desc=True).limit(1).execute()
        if result.data:
            return {"status": "active", "last_backup": result.data[0].get("backup_at")}
        return {"status": "no_backups"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==================== GOOGLE CALENDAR ROUTES ====================

def get_google_flow():
    """Create Google OAuth flow"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Calendar not configured")
    
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI]
        }
    }
    
    flow = Flow.from_client_config(client_config, scopes=GOOGLE_SCOPES)
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    return flow

async def get_user_google_credentials(user_id: str):
    """Get stored Google credentials for a user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "google_tokens": 1})
    if not user or not user.get("google_tokens"):
        return None
    
    tokens = user["google_tokens"]
    credentials = Credentials(
        token=tokens.get("access_token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_SCOPES
    )
    
    # Refresh if expired
    if credentials.expired and credentials.refresh_token:
        try:
            from google.auth.transport.requests import Request
            credentials.refresh(Request())
            # Save refreshed tokens
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"google_tokens.access_token": credentials.token}}
            )
        except Exception as e:
            logger.error(f"Failed to refresh Google token: {e}")
            return None
    
    return credentials

def build_calendar_event(appointment: dict) -> dict:
    """Build a Google Calendar event from an appointment"""
    import pytz
    
    # Build description with client details
    pets_info = []
    for pet in appointment.get("pets", []):
        pet_name = pet.get("pet_name", "Unknown Pet")
        services = pet.get("services", [])
        service_names = [s.get("service_name", s.get("service_id", "")) for s in services] if isinstance(services, list) and services and isinstance(services[0], dict) else []
        pets_info.append(f"{pet_name}: {', '.join(service_names) if service_names else 'No services'}")
    
    description_parts = []
    if appointment.get("client_name"):
        description_parts.append(f"Client: {appointment['client_name']}")
    
    # Get client phone and address
    client_phone = appointment.get("client_phone", "")
    client_address = appointment.get("client_address", "")
    
    if client_phone:
        description_parts.append(f"Phone: {client_phone}")
    if client_address:
        description_parts.append(f"Address: {client_address}")
    if pets_info:
        description_parts.append(f"\nPets & Services:\n" + "\n".join(pets_info))
    if appointment.get("notes"):
        description_parts.append(f"\nNotes: {appointment['notes']}")
    
    description = "\n".join(description_parts)
    
    # Parse times - appointments are stored in local time (Australia/Sydney)
    start_time = appointment.get("date_time", "")
    end_time = appointment.get("end_time", "")
    
    # Build event title
    client_name = appointment.get("client_name", "Appointment")
    pet_names = [p.get("pet_name", "") for p in appointment.get("pets", [])]
    title = f"{client_name}"
    if pet_names:
        title += f" ({', '.join(filter(None, pet_names))})"
    
    event = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": start_time,
            "timeZone": "Australia/Sydney"
        },
        "end": {
            "dateTime": end_time,
            "timeZone": "Australia/Sydney"
        },
        "extendedProperties": {
            "private": {
                "gromify_id": appointment.get("id", ""),
                "gromify_client_id": appointment.get("client_id", "")
            }
        }
    }
    
    # Add location if available
    if client_address:
        event["location"] = client_address
    
    return event

@api_router.get("/auth/google/connect")
async def google_connect(user_id: str = Depends(get_current_user)):
    """Start Google OAuth flow - returns authorization URL"""
    try:
        flow = get_google_flow()
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Store state for validation
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"google_oauth_state": state}}
        )
        
        return {"authorization_url": authorization_url, "state": state}
    except Exception as e:
        logger.error(f"Google connect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/google/callback")
async def google_callback(code: str = Query(...), state: str = Query(None)):
    """Handle Google OAuth callback"""
    try:
        flow = get_google_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Find user by state
        user = await db.users.find_one({"google_oauth_state": state}, {"_id": 0, "id": 1})
        if not user:
            # Redirect with error
            return RedirectResponse(url="/settings?google_error=invalid_state")
        
        # Save tokens
        tokens = {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "scopes": list(credentials.scopes) if credentials.scopes else GOOGLE_SCOPES
        }
        
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "google_tokens": tokens,
                    "google_calendar_connected": True
                },
                "$unset": {"google_oauth_state": ""}
            }
        )
        
        logger.info(f"Google Calendar connected for user {user['id']}")
        
        # Redirect back to settings with success
        return RedirectResponse(url="/settings?google_connected=true")
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        return RedirectResponse(url=f"/settings?google_error={str(e)}")

@api_router.post("/auth/google/disconnect")
async def google_disconnect(user_id: str = Depends(get_current_user)):
    """Disconnect Google Calendar"""
    await db.users.update_one(
        {"id": user_id},
        {
            "$unset": {"google_tokens": "", "google_oauth_state": ""},
            "$set": {"google_calendar_connected": False}
        }
    )
    return {"message": "Google Calendar disconnected"}

@api_router.get("/auth/google/status")
async def google_status(user_id: str = Depends(get_current_user)):
    """Check Google Calendar connection status"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "google_calendar_connected": 1, "google_tokens": 1})
    
    connected = user.get("google_calendar_connected", False) if user else False
    has_tokens = bool(user.get("google_tokens")) if user else False
    
    return {
        "connected": connected and has_tokens,
        "configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    }

@api_router.post("/calendar/sync/{appointment_id}")
async def sync_appointment_to_google(
    appointment_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user)
):
    """Sync a single appointment to Google Calendar"""
    credentials = await get_user_google_credentials(user_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    appointment = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Get client details for the event
    client = await db.clients.find_one({"id": appointment.get("client_id")}, {"_id": 0})
    if client:
        appointment["client_phone"] = client.get("phone", "")
        appointment["client_address"] = client.get("address", "")
    
    try:
        service = build('calendar', 'v3', credentials=credentials)
        event = build_calendar_event(appointment)
        
        # Check if event already exists
        google_event_id = appointment.get("google_event_id")
        
        if google_event_id:
            # Update existing event
            result = service.events().update(
                calendarId='primary',
                eventId=google_event_id,
                body=event
            ).execute()
        else:
            # Create new event
            result = service.events().insert(
                calendarId='primary',
                body=event
            ).execute()
            
            # Save Google event ID
            await db.appointments.update_one(
                {"id": appointment_id},
                {"$set": {"google_event_id": result.get("id")}}
            )
        
        return {"message": "Synced to Google Calendar", "google_event_id": result.get("id")}
    except HttpError as e:
        logger.error(f"Google Calendar API error: {e}")
        raise HTTPException(status_code=500, detail=f"Google Calendar error: {str(e)}")

@api_router.post("/calendar/sync-all")
async def sync_all_appointments_to_google(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user)
):
    """Sync all future appointments to Google Calendar"""
    credentials = await get_user_google_credentials(user_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    # Get all future appointments
    now = datetime.now(timezone.utc).isoformat()
    appointments = await db.appointments.find(
        {"user_id": user_id, "date_time": {"$gte": now}, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).to_list(500)
    
    if not appointments:
        return {"message": "No appointments to sync", "synced": 0}
    
    # Get all clients for phone/address info
    client_ids = list(set(a.get("client_id") for a in appointments if a.get("client_id")))
    clients = await db.clients.find({"id": {"$in": client_ids}}, {"_id": 0}).to_list(100)
    client_map = {c["id"]: c for c in clients}
    
    try:
        service = build('calendar', 'v3', credentials=credentials)
        synced = 0
        errors = 0
        
        for appointment in appointments:
            try:
                # Add client details
                client = client_map.get(appointment.get("client_id"), {})
                appointment["client_phone"] = client.get("phone", "")
                appointment["client_address"] = client.get("address", "")
                
                event = build_calendar_event(appointment)
                google_event_id = appointment.get("google_event_id")
                
                if google_event_id:
                    service.events().update(
                        calendarId='primary',
                        eventId=google_event_id,
                        body=event
                    ).execute()
                else:
                    result = service.events().insert(
                        calendarId='primary',
                        body=event
                    ).execute()
                    
                    await db.appointments.update_one(
                        {"id": appointment["id"]},
                        {"$set": {"google_event_id": result.get("id")}}
                    )
                
                synced += 1
            except Exception as e:
                logger.error(f"Failed to sync appointment {appointment.get('id')}: {e}")
                errors += 1
        
        return {"message": f"Synced {synced} appointments", "synced": synced, "errors": errors}
    except Exception as e:
        logger.error(f"Sync all error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/calendar/import-from-google")
async def import_from_google_calendar(
    user_id: str = Depends(get_current_user)
):
    """Import events from Google Calendar to the app (two-way sync)"""
    credentials = await get_user_google_credentials(user_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    try:
        service = build('calendar', 'v3', credentials=credentials)
        
        # Get events from Google Calendar from now onwards
        now = datetime.now(timezone.utc).isoformat()
        events_result = service.events().list(
            calendarId='primary',
            timeMin=now,
            maxResults=100,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        imported = 0
        updated = 0
        skipped = 0
        
        for event in events:
            try:
                # Skip all-day events or events without start time
                if not event.get('start', {}).get('dateTime'):
                    skipped += 1
                    continue
                
                # Check if this event was created by our app
                extended_props = event.get('extendedProperties', {}).get('private', {})
                gromify_id = extended_props.get('gromify_id')
                
                # If this event was created by our app, skip it (already synced)
                if gromify_id:
                    existing = await db.appointments.find_one({"id": gromify_id, "user_id": user_id}, {"_id": 0})
                    if existing:
                        skipped += 1
                        continue
                
                # Parse event details
                start_time = event['start']['dateTime']
                end_time = event['end']['dateTime']
                summary = event.get('summary', 'Imported from Google Calendar')
                description = event.get('description', '')
                location = event.get('location', '')
                
                # Check if appointment with this google_event_id already exists
                existing_appt = await db.appointments.find_one(
                    {"google_event_id": event['id'], "user_id": user_id},
                    {"_id": 0}
                )
                
                if existing_appt:
                    # Update existing appointment
                    await db.appointments.update_one(
                        {"id": existing_appt["id"]},
                        {"$set": {
                            "date_time": start_time,
                            "end_time": end_time,
                            "notes": description,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    updated += 1
                else:
                    # Create new appointment from Google Calendar event
                    new_appointment = {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "client_id": "",
                        "client_name": summary,
                        "date_time": start_time,
                        "end_time": end_time,
                        "status": "scheduled",
                        "notes": f"{description}\n\nImported from Google Calendar",
                        "is_recurring": False,
                        "recurring_value": None,
                        "recurring_unit": None,
                        "recurring_id": None,
                        "pets": [],
                        "total_duration": 60,
                        "total_price": 0.0,
                        "google_event_id": event['id'],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.appointments.insert_one(new_appointment)
                    imported += 1
                    
            except Exception as e:
                logger.error(f"Failed to import event {event.get('id')}: {e}")
                skipped += 1
        
        return {
            "message": f"Import complete",
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "total_events": len(events)
        }
        
    except Exception as e:
        logger.error(f"Import from Google error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/calendar/sync/{appointment_id}")
async def delete_from_google_calendar(
    appointment_id: str,
    user_id: str = Depends(get_current_user)
):
    """Delete an appointment from Google Calendar"""
    credentials = await get_user_google_credentials(user_id)
    if not credentials:
        return {"message": "Google Calendar not connected"}
    
    appointment = await db.appointments.find_one({"id": appointment_id, "user_id": user_id}, {"_id": 0})
    if not appointment:
        return {"message": "Appointment not found"}
    
    google_event_id = appointment.get("google_event_id")
    if not google_event_id:
        return {"message": "Not synced to Google Calendar"}
    
    try:
        service = build('calendar', 'v3', credentials=credentials)
        service.events().delete(calendarId='primary', eventId=google_event_id).execute()
        
        # Remove Google event ID
        await db.appointments.update_one(
            {"id": appointment_id},
            {"$unset": {"google_event_id": ""}}
        )
        
        return {"message": "Deleted from Google Calendar"}
    except HttpError as e:
        if e.resp.status == 404:
            # Event already deleted
            await db.appointments.update_one(
                {"id": appointment_id},
                {"$unset": {"google_event_id": ""}}
            )
            return {"message": "Event already deleted"}
        raise HTTPException(status_code=500, detail=str(e))

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
