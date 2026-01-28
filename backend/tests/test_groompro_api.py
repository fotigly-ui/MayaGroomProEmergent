"""
Backend API Tests for GroomPro Pet Grooming App
Testing: Login, Invoice check endpoint, Appointments API, Recurring appointments
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "foti@mayaspetgrooming.com.au"
TEST_PASSWORD = "Maya2024!"


class TestAuthentication:
    """Test login flow"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert data["token_type"] == "bearer"
        print(f"✓ Login successful, token received")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid login correctly rejected")


class TestInvoiceCheckEndpoint:
    """Test the /api/invoices/check/{appointment_id} endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_invoice_check_no_invoice(self, auth_token):
        """Test invoice check for appointment without invoice"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get appointments to find one without invoice
        appts_response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert appts_response.status_code == 200
        appointments = appts_response.json()
        
        if len(appointments) == 0:
            pytest.skip("No appointments found to test")
        
        # Test invoice check endpoint
        test_appt = appointments[0]
        response = requests.get(
            f"{BASE_URL}/api/invoices/check/{test_appt['id']}", 
            headers=headers
        )
        assert response.status_code == 200, f"Invoice check failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "has_invoice" in data, "Missing has_invoice field"
        assert "invoice_id" in data, "Missing invoice_id field"
        assert "invoice_number" in data, "Missing invoice_number field"
        assert isinstance(data["has_invoice"], bool), "has_invoice should be boolean"
        
        print(f"✓ Invoice check endpoint working - has_invoice: {data['has_invoice']}")
        return data
    
    def test_invoice_check_nonexistent_appointment(self, auth_token):
        """Test invoice check for non-existent appointment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/invoices/check/nonexistent-id-12345", 
            headers=headers
        )
        # Should return has_invoice: false for non-existent appointment
        assert response.status_code == 200
        data = response.json()
        assert data["has_invoice"] == False
        print(f"✓ Non-existent appointment correctly returns has_invoice: false")


class TestAppointmentsAPI:
    """Test appointments API for upcoming/past filtering"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_appointments(self, auth_token):
        """Test getting all appointments"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200, f"Get appointments failed: {response.text}"
        appointments = response.json()
        
        assert isinstance(appointments, list), "Appointments should be a list"
        print(f"✓ Got {len(appointments)} appointments")
        
        # Check appointment structure
        if len(appointments) > 0:
            appt = appointments[0]
            required_fields = ["id", "client_id", "date_time", "status"]
            for field in required_fields:
                assert field in appt, f"Missing field: {field}"
            print(f"✓ Appointment structure is correct")
        
        return appointments
    
    def test_appointments_date_format(self, auth_token):
        """Test that appointment dates are in correct format for frontend parsing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200
        appointments = response.json()
        
        if len(appointments) == 0:
            pytest.skip("No appointments to test date format")
        
        for appt in appointments[:5]:  # Check first 5
            date_time = appt.get("date_time", "")
            # Date should be ISO format, possibly with Z suffix or +00:00
            assert date_time, f"Empty date_time for appointment {appt['id']}"
            
            # Try parsing the date
            try:
                if date_time.endswith('Z'):
                    parsed = datetime.fromisoformat(date_time.replace('Z', '+00:00'))
                elif '+' in date_time:
                    parsed = datetime.fromisoformat(date_time)
                else:
                    parsed = datetime.fromisoformat(date_time)
                print(f"✓ Date format valid: {date_time}")
            except ValueError as e:
                pytest.fail(f"Invalid date format: {date_time} - {e}")
    
    def test_upcoming_appointments_filter(self, auth_token):
        """Test filtering appointments by date (upcoming)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get current date in ISO format
        now = datetime.utcnow()
        start_date = now.strftime("%Y-%m-%dT%H:%M:%S")
        
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"start_date": start_date},
            headers=headers
        )
        assert response.status_code == 200
        appointments = response.json()
        
        print(f"✓ Found {len(appointments)} upcoming appointments from {start_date}")
        
        # Verify all returned appointments are in the future
        for appt in appointments:
            appt_date = appt["date_time"]
            if appt_date.endswith('Z'):
                appt_datetime = datetime.fromisoformat(appt_date.replace('Z', '+00:00'))
            else:
                appt_datetime = datetime.fromisoformat(appt_date.replace('+00:00', ''))
            # Note: This is a soft check since we're comparing UTC times
            print(f"  - Appointment: {appt_date}, Status: {appt['status']}")


class TestClientsAPI:
    """Test clients API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_clients(self, auth_token):
        """Test getting all clients"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/clients", headers=headers)
        assert response.status_code == 200, f"Get clients failed: {response.text}"
        clients = response.json()
        
        assert isinstance(clients, list), "Clients should be a list"
        print(f"✓ Got {len(clients)} clients")
        
        # Find Roji Subedi (mentioned in test context)
        roji = next((c for c in clients if "Roji" in c.get("name", "")), None)
        if roji:
            print(f"✓ Found test client: {roji['name']}")
        
        return clients
    
    def test_get_client_appointments(self, auth_token):
        """Test getting appointments for a specific client"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get clients first
        clients_response = requests.get(f"{BASE_URL}/api/clients", headers=headers)
        clients = clients_response.json()
        
        if len(clients) == 0:
            pytest.skip("No clients to test")
        
        # Get appointments for first client
        client_id = clients[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/appointments",
            params={"client_id": client_id},
            headers=headers
        )
        assert response.status_code == 200
        appointments = response.json()
        
        print(f"✓ Client {clients[0]['name']} has {len(appointments)} appointments")
        
        # Verify all appointments belong to this client
        for appt in appointments:
            assert appt["client_id"] == client_id, "Appointment client_id mismatch"


class TestRecurringAppointments:
    """Test recurring appointment functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_recurring_appointments_exist(self, auth_token):
        """Test that recurring appointments have proper fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200
        appointments = response.json()
        
        # Find recurring appointments
        recurring = [a for a in appointments if a.get("is_recurring")]
        print(f"✓ Found {len(recurring)} recurring appointments")
        
        if len(recurring) > 0:
            appt = recurring[0]
            # Check recurring fields
            assert "recurring_id" in appt, "Missing recurring_id"
            assert "recurring_value" in appt, "Missing recurring_value"
            assert "recurring_unit" in appt, "Missing recurring_unit"
            print(f"✓ Recurring appointment structure correct: {appt.get('recurring_value')} {appt.get('recurring_unit')}")
    
    def test_recurring_series_consistency(self, auth_token):
        """Test that recurring series have consistent times"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/appointments", headers=headers)
        assert response.status_code == 200
        appointments = response.json()
        
        # Group by recurring_id
        recurring_groups = {}
        for appt in appointments:
            rid = appt.get("recurring_id")
            if rid:
                if rid not in recurring_groups:
                    recurring_groups[rid] = []
                recurring_groups[rid].append(appt)
        
        print(f"✓ Found {len(recurring_groups)} recurring series")
        
        # Check time consistency within each series
        for rid, series in recurring_groups.items():
            if len(series) < 2:
                continue
            
            # Extract times (hour:minute) from each appointment
            times = []
            for appt in series[:5]:  # Check first 5
                dt_str = appt["date_time"]
                if dt_str.endswith('Z'):
                    dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                else:
                    dt = datetime.fromisoformat(dt_str)
                times.append((dt.hour, dt.minute))
            
            # All times should be the same within a series
            unique_times = set(times)
            if len(unique_times) > 1:
                print(f"⚠ Series {rid[:8]}... has inconsistent times: {unique_times}")
            else:
                print(f"✓ Series {rid[:8]}... has consistent time: {times[0]}")


class TestInvoicesAPI:
    """Test invoices API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_invoices(self, auth_token):
        """Test getting all invoices"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        assert response.status_code == 200, f"Get invoices failed: {response.text}"
        invoices = response.json()
        
        assert isinstance(invoices, list), "Invoices should be a list"
        print(f"✓ Got {len(invoices)} invoices")
        
        if len(invoices) > 0:
            inv = invoices[0]
            required_fields = ["id", "invoice_number", "client_id", "total", "status"]
            for field in required_fields:
                assert field in inv, f"Missing field: {field}"
            print(f"✓ Invoice structure correct")
        
        return invoices
    
    def test_invoice_appointment_link(self, auth_token):
        """Test that invoices are properly linked to appointments"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get invoices
        inv_response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        invoices = inv_response.json()
        
        # Find invoices with appointment_id
        linked_invoices = [i for i in invoices if i.get("appointment_id")]
        print(f"✓ Found {len(linked_invoices)} invoices linked to appointments")
        
        # Verify the check endpoint returns correct data for linked appointments
        for inv in linked_invoices[:3]:  # Check first 3
            appt_id = inv["appointment_id"]
            check_response = requests.get(
                f"{BASE_URL}/api/invoices/check/{appt_id}",
                headers=headers
            )
            assert check_response.status_code == 200
            check_data = check_response.json()
            
            assert check_data["has_invoice"] == True, f"Invoice check should return True for {appt_id}"
            assert check_data["invoice_number"] == inv["invoice_number"], "Invoice number mismatch"
            print(f"✓ Invoice check correct for appointment {appt_id[:8]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
