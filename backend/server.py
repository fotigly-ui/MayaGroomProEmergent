from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
    confirmation_request_days: int = 2  # Days before appointment
    send_24h_reminder: bool = True
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
    confirmation_request_days: Optional[int] = None
    send_24h_reminder: Optional[bool] = None

# Client Model
class ClientCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""

class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    no_show_count: int = 0
    last_no_show: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

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
    recurring_id: Optional[str] = None
    pets: List[AppointmentPet] = Field(default_factory=list)
    total_duration: int = 0
    total_price: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentUpdate(BaseModel):
    date_time: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    pets: Optional[List[AppointmentPetCreate]] = None

# Waitlist Model
class WaitlistCreate(BaseModel):
    client_id: str
    preferred_pets: List[str] = Field(default_factory=list)
    preferred_services: List[str] = Field(default_factory=list)
    notes: str = ""

class Waitlist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    client_id: str
    client_name: str = ""
    preferred_pets: List[str] = Field(default_factory=list)
    preferred_services: List[str] = Field(default_factory=list)
    notes: str = ""
    date_added: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WaitlistUpdate(BaseModel):
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

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

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
    
    end_time = appt.date_time + timedelta(minutes=total_duration)
    
    new_appointment = Appointment(
        user_id=user_id,
        client_id=appt.client_id,
        client_name=client["name"],
        date_time=appt.date_time,
        end_time=end_time,
        notes=appt.notes,
        is_recurring=appt.is_recurring,
        recurring_id=appt.recurring_id,
        pets=[p.model_dump() for p in appointment_pets],
        total_duration=total_duration,
        total_price=total_price
    )
    
    appt_doc = prepare_doc_for_mongo(new_appointment.model_dump())
    # Serialize nested pets
    appt_doc["pets"] = [prepare_doc_for_mongo(p) if isinstance(p, dict) else p for p in appt_doc.get("pets", [])]
    
    await db.appointments.insert_one(appt_doc)
    # Trigger backup
    background_tasks.add_task(backup_collection_to_supabase, "appointments", user_id)
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
async def update_appointment(appointment_id: str, update: AppointmentUpdate, user_id: str = Depends(get_current_user)):
    update_data = {}
    
    if update.date_time:
        update_data["date_time"] = update.date_time.isoformat()
        # Recalculate end time
        appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
        if appt:
            duration = appt.get("total_duration", 60)
            update_data["end_time"] = (update.date_time + timedelta(minutes=duration)).isoformat()
    
    if update.status:
        update_data["status"] = update.status
        # Track no-shows
        if update.status == "no_show":
            appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
            if appt:
                await db.clients.update_one(
                    {"id": appt["client_id"]},
                    {
                        "$inc": {"no_show_count": 1},
                        "$set": {"last_no_show": datetime.now(timezone.utc).isoformat()}
                    }
                )
    
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
    
    result = await db.appointments.update_one(
        {"id": appointment_id, "user_id": user_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    return parse_datetime_fields(appt, ["date_time", "end_time", "created_at"])

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, user_id: str = Depends(get_current_user)):
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
