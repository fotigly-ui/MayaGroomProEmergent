"""
Backend API Tests for Maya Groom Pro - Pet Grooming Appointment App
Tests: Auth, Clients, Services, Appointments, SMS Templates
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://groome.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@maya.com"
TEST_PASSWORD = "test123"

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data["token_type"] == "bearer"
        print(f"✓ Login successful, token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly rejected")
    
    def test_get_me_authenticated(self, auth_token):
        """Test getting current user info"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        print(f"✓ Get current user successful: {data['email']}")
    
    def test_get_me_unauthenticated(self):
        """Test getting current user without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")


class TestClients:
    """Client CRUD endpoint tests"""
    
    def test_get_clients(self, auth_token):
        """Test listing clients"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/clients", headers=headers)
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get clients successful, found {len(data)} clients")
        return data
    
    def test_create_client(self, auth_token):
        """Test creating a new client"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        client_data = {
            "name": f"TEST_Client_{datetime.now().strftime('%H%M%S')}",
            "phone": "0400123456",
            "email": "testclient@example.com",
            "address": "123 Test St"
        }
        response = requests.post(f"{BASE_URL}/api/clients", json=client_data, headers=headers)
        assert response.status_code == 200, f"Create client failed: {response.text}"
        data = response.json()
        assert data["name"] == client_data["name"]
        assert "id" in data
        print(f"✓ Create client successful: {data['name']}")
        return data
    
    def test_get_client_by_id(self, auth_token):
        """Test getting a specific client"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # First get list of clients
        clients = requests.get(f"{BASE_URL}/api/clients", headers=headers).json()
        if clients:
            client_id = clients[0]["id"]
            response = requests.get(f"{BASE_URL}/api/clients/{client_id}", headers=headers)
            assert response.status_code == 200, f"Get client failed: {response.text}"
            data = response.json()
            assert data["id"] == client_id
            print(f"✓ Get client by ID successful: {data['name']}")
        else:
            pytest.skip("No clients to test")


class TestServices:
    """Service CRUD endpoint tests"""
    
    def test_get_services(self, auth_token):
        """Test listing services"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/services", headers=headers)
        assert response.status_code == 200, f"Get services failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get services successful, found {len(data)} services")
        return data
    
    def test_create_service(self, auth_token):
        """Test creating a new service"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        service_data = {
            "name": f"TEST_Service_{datetime.now().strftime('%H%M%S')}",
            "duration": 60,
            "price": 50.0
        }
        response = requests.post(f"{BASE_URL}/api/services", json=service_data, headers=headers)
        assert response.status_code == 200, f"Create service failed: {response.text}"
        data = response.json()
        assert data["name"] == service_data["name"]
        assert data["duration"] == 60
        assert data["price"] == 50.0
        print(f"✓ Create service successful: {data['name']}")
        return data


class TestAppointments:
    """Appointment CRUD endpoint tests"""
    
    def test_get_appointments(self, auth_token):
        """Test listing appointments"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200, f"Get appointments failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get appointments successful, found {len(data)} appointments")
        return data
    
    def test_get_appointments_with_date_filter(self, auth_token):
        """Test listing appointments with date filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        start_date = datetime.now().isoformat()
        end_date = (datetime.now() + timedelta(days=7)).isoformat()
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"start_date": start_date, "end_date": end_date},
            headers=headers
        )
        assert response.status_code == 200, f"Get appointments with filter failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get appointments with date filter successful, found {len(data)} appointments")
    
    def test_create_appointment(self, auth_token):
        """Test creating a new appointment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get a client
        clients = requests.get(f"{BASE_URL}/api/clients", headers=headers).json()
        if not clients:
            pytest.skip("No clients available for appointment test")
        
        client_id = clients[0]["id"]
        
        # Get services
        services = requests.get(f"{BASE_URL}/api/services", headers=headers).json()
        service_ids = [s["id"] for s in services[:1]] if services else []
        
        appointment_data = {
            "client_id": client_id,
            "date_time": (datetime.now() + timedelta(days=1)).isoformat(),
            "notes": "TEST appointment",
            "is_recurring": False,
            "pets": [
                {
                    "pet_name": "Test Pet",
                    "services": service_ids
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=appointment_data, headers=headers)
        assert response.status_code == 200, f"Create appointment failed: {response.text}"
        data = response.json()
        assert data["client_id"] == client_id
        assert "id" in data
        print(f"✓ Create appointment successful for client: {data['client_name']}")
        return data
    
    def test_update_appointment(self, auth_token):
        """Test updating an appointment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get existing appointments
        appointments = requests.get(f"{BASE_URL}/api/appointments", headers=headers).json()
        if not appointments:
            pytest.skip("No appointments to update")
        
        appt_id = appointments[0]["id"]
        update_data = {
            "notes": f"Updated at {datetime.now().isoformat()}",
            "status": "scheduled"
        }
        
        response = requests.put(f"{BASE_URL}/api/appointments/{appt_id}", json=update_data, headers=headers)
        assert response.status_code == 200, f"Update appointment failed: {response.text}"
        data = response.json()
        assert "Updated at" in data["notes"]
        print(f"✓ Update appointment successful")


class TestSMSTemplates:
    """SMS Templates endpoint tests"""
    
    def test_get_sms_templates(self, auth_token):
        """Test getting SMS templates"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/sms/templates", headers=headers)
        assert response.status_code == 200, f"Get SMS templates failed: {response.text}"
        data = response.json()
        assert "templates" in data
        templates = data["templates"]
        # Check for expected template types
        expected_types = ["appointment_booked", "reminder_24h", "confirmation_request"]
        for template_type in expected_types:
            assert template_type in templates, f"Missing template: {template_type}"
        print(f"✓ Get SMS templates successful, found {len(templates)} templates")


class TestSettings:
    """Settings endpoint tests"""
    
    def test_get_settings(self, auth_token):
        """Test getting user settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        print(f"✓ Get settings successful")
    
    def test_update_settings(self, auth_token):
        """Test updating settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        update_data = {
            "business_name": "Test Business Updated"
        }
        response = requests.put(f"{BASE_URL}/api/settings", json=update_data, headers=headers)
        assert response.status_code == 200, f"Update settings failed: {response.text}"
        data = response.json()
        assert data["business_name"] == "Test Business Updated"
        print(f"✓ Update settings successful")


class TestDashboard:
    """Dashboard stats endpoint tests"""
    
    def test_get_dashboard_stats(self, auth_token):
        """Test getting dashboard statistics"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Get dashboard stats failed: {response.text}"
        data = response.json()
        assert "today_appointments" in data
        assert "week_appointments" in data
        assert "total_clients" in data
        assert "waitlist_count" in data
        print(f"✓ Get dashboard stats successful: {data}")


class TestPets:
    """Pet CRUD endpoint tests"""
    
    def test_get_pets(self, auth_token):
        """Test listing pets"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/pets", headers=headers)
        assert response.status_code == 200, f"Get pets failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get pets successful, found {len(data)} pets")
    
    def test_get_pets_by_client(self, auth_token):
        """Test listing pets for a specific client"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Get clients first
        clients = requests.get(f"{BASE_URL}/api/clients", headers=headers).json()
        if clients:
            client_id = clients[0]["id"]
            response = requests.get(f"{BASE_URL}/api/pets", params={"client_id": client_id}, headers=headers)
            assert response.status_code == 200, f"Get pets by client failed: {response.text}"
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Get pets by client successful, found {len(data)} pets")
        else:
            pytest.skip("No clients to test pets")


class TestInvoices:
    """Invoice endpoint tests"""
    
    def test_get_invoices(self, auth_token):
        """Test listing invoices"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        assert response.status_code == 200, f"Get invoices failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get invoices successful, found {len(data)} invoices")


class TestWaitlist:
    """Waitlist endpoint tests"""
    
    def test_get_waitlist(self, auth_token):
        """Test listing waitlist entries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/waitlist", headers=headers)
        assert response.status_code == 200, f"Get waitlist failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Get waitlist successful, found {len(data)} entries")


class TestAPIRoot:
    """API root endpoint test"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "Maya Groom Pro API" in data["message"]
        print(f"✓ API root accessible: {data}")


# Fixtures
@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.fail(f"Authentication failed: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
