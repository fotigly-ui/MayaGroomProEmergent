#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class RecurringAppointmentsAPITester:
    def __init__(self, base_url="https://grooming-hub-49.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.test_client_id = None
        self.test_service_id = None
        self.test_recurring_id = None
        self.test_appointment_ids = []
        self.test_single_appointment_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, expected_status=200, params=None):
        """Make API request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params)

            success = response.status_code == expected_status
            return success, response.json() if success else response.text, response.status_code

        except Exception as e:
            return False, str(e), 0

    def setup_test_data(self):
        """Setup required test data (auth, client, service)"""
        print("🔧 Setting up test data...")
        
        # 1. Register/Login
        test_email = f"recurtest_{uuid.uuid4().hex[:8]}@mayatest.com"
        register_data = {
            "email": test_email,
            "password": "testpass123",
            "business_name": "Recurring Test Grooming"
        }
        
        success, response, status = self.make_request('POST', 'auth/register', register_data, 200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            print("✅ User registered and authenticated")
        else:
            print(f"❌ Authentication failed: {status}, {response}")
            return False

        # 2. Get user info
        success, response, status = self.make_request('GET', 'auth/me', None, 200)
        if success and 'id' in response:
            self.user_id = response['id']
            print("✅ User info retrieved")
        else:
            print(f"❌ Failed to get user info: {status}")
            return False

        # 3. Create test client
        client_data = {
            "name": "Sarah Johnson",
            "phone": "+61 400 555 123",
            "email": "sarah.johnson@example.com",
            "address": "456 Pet Street, Dog City"
        }
        
        success, response, status = self.make_request('POST', 'clients', client_data, 200)
        if success and 'id' in response:
            self.test_client_id = response['id']
            print("✅ Test client created")
        else:
            print(f"❌ Failed to create client: {status}, {response}")
            return False

        # 4. Create test service
        service_data = {
            "name": "Weekly Grooming",
            "duration": 60,
            "price": 75.00
        }
        
        success, response, status = self.make_request('POST', 'services', service_data, 200)
        if success and 'id' in response:
            self.test_service_id = response['id']
            print("✅ Test service created")
        else:
            print(f"❌ Failed to create service: {status}, {response}")
            return False

        return True

    def test_recurring_appointments_creation(self):
        """Test Flow 1: Recurring Appointments Creation (P0 - MOST CRITICAL)"""
        print("\n🔄 Testing Recurring Appointments Creation...")
        
        # Create recurring appointment: every 2 weeks starting tomorrow at 10:00 AM
        tomorrow = datetime.now() + timedelta(days=1)
        appointment_time = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Recurring grooming appointment",
            "is_recurring": True,
            "recurring_value": 2,
            "recurring_unit": "week",
            "pets": [
                {
                    "pet_name": "Max",
                    "services": [self.test_service_id]
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if not success:
            self.log_test("Create Recurring Appointment", False, f"Status: {status}, Response: {response}")
            return False
        
        if 'id' not in response or not response.get('is_recurring') or not response.get('recurring_id'):
            self.log_test("Create Recurring Appointment", False, "Missing recurring fields in response")
            return False
        
        self.test_recurring_id = response.get('recurring_id')
        print(f"✅ Recurring appointment created with recurring_id: {self.test_recurring_id}")
        
        # Verify multiple appointments were created
        today = datetime.now().date()
        one_year_later = today + timedelta(days=365)
        
        params = {
            "start_date": today.isoformat(),
            "end_date": one_year_later.isoformat()
        }
        
        success, appointments, status = self.make_request('GET', 'appointments', None, 200, params)
        if not success:
            self.log_test("Verify Recurring Appointments Created", False, f"Failed to fetch appointments: {status}")
            return False
        
        # Filter appointments with our recurring_id
        recurring_appointments = [apt for apt in appointments if apt.get('recurring_id') == self.test_recurring_id]
        
        if len(recurring_appointments) < 20:  # Should have ~26 appointments for every 2 weeks in a year
            self.log_test("Verify Recurring Appointments Created", False, f"Only {len(recurring_appointments)} appointments created, expected ~26")
            return False
        
        # Verify all appointments have correct properties
        for apt in recurring_appointments:
            if not all([
                apt.get('recurring_id') == self.test_recurring_id,
                apt.get('is_recurring') == True,
                apt.get('client_id') == self.test_client_id,
                apt.get('notes') == "Recurring grooming appointment",
                len(apt.get('pets', [])) == 1,
                apt.get('pets', [{}])[0].get('pet_name') == "Max"
            ]):
                self.log_test("Verify Recurring Appointments Properties", False, f"Appointment {apt.get('id')} has incorrect properties")
                return False
        
        # Verify date intervals (every 2 weeks)
        sorted_appointments = sorted(recurring_appointments, key=lambda x: x['date_time'])
        for i in range(1, min(5, len(sorted_appointments))):  # Check first 5 appointments
            prev_date = datetime.fromisoformat(sorted_appointments[i-1]['date_time'].replace('Z', '+00:00'))
            curr_date = datetime.fromisoformat(sorted_appointments[i]['date_time'].replace('Z', '+00:00'))
            diff_days = (curr_date - prev_date).days
            
            if diff_days != 14:  # Should be exactly 14 days apart
                self.log_test("Verify Recurring Appointments Intervals", False, f"Appointments are {diff_days} days apart, expected 14")
                return False
        
        self.test_appointment_ids = [apt['id'] for apt in recurring_appointments]
        self.log_test("Recurring Appointments Creation", True, f"Created {len(recurring_appointments)} appointments with correct 2-week intervals")
        return True

    def test_series_update(self):
        """Test Flow 2: Series Update (P0)"""
        print("\n📝 Testing Series Update...")
        
        if not self.test_appointment_ids or len(self.test_appointment_ids) < 10:
            self.log_test("Series Update", False, "Not enough recurring appointments to test")
            return False
        
        # Pick an appointment in the middle of the series
        middle_appointment_id = self.test_appointment_ids[5]
        
        update_data = {
            "notes": "Updated series note - all future appointments",
            "update_series": True
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{middle_appointment_id}', update_data, 200)
        if not success:
            self.log_test("Update Series", False, f"Failed to update series: {status}, {response}")
            return False
        
        # Verify all future appointments have the updated note
        params = {
            "start_date": datetime.now().date().isoformat(),
            "end_date": (datetime.now().date() + timedelta(days=365)).isoformat()
        }
        
        success, appointments, status = self.make_request('GET', 'appointments', None, 200, params)
        if not success:
            self.log_test("Verify Series Update", False, f"Failed to fetch appointments: {status}")
            return False
        
        # Filter future appointments with our recurring_id
        future_appointments = [
            apt for apt in appointments 
            if apt.get('recurring_id') == self.test_recurring_id and 
            datetime.fromisoformat(apt['date_time'].replace('Z', '+00:00')) >= datetime.now()
        ]
        
        updated_count = 0
        for apt in future_appointments:
            if apt.get('notes') == "Updated series note - all future appointments":
                updated_count += 1
        
        if updated_count < 10:  # Should have updated many future appointments
            self.log_test("Series Update", False, f"Only {updated_count} future appointments updated")
            return False
        
        self.log_test("Series Update", True, f"Successfully updated {updated_count} future appointments")
        return True

    def test_series_delete(self):
        """Test Flow 3: Series Delete (P0)"""
        print("\n🗑️ Testing Series Delete...")
        
        if not self.test_appointment_ids or len(self.test_appointment_ids) < 15:
            self.log_test("Series Delete", False, "Not enough recurring appointments to test")
            return False
        
        # Pick another appointment for deletion
        delete_appointment_id = self.test_appointment_ids[10]
        
        # Count appointments before deletion
        params = {
            "start_date": datetime.now().date().isoformat(),
            "end_date": (datetime.now().date() + timedelta(days=365)).isoformat()
        }
        
        success, appointments_before, status = self.make_request('GET', 'appointments', None, 200, params)
        if not success:
            self.log_test("Series Delete - Count Before", False, f"Failed to fetch appointments: {status}")
            return False
        
        future_count_before = len([
            apt for apt in appointments_before 
            if apt.get('recurring_id') == self.test_recurring_id and 
            datetime.fromisoformat(apt['date_time'].replace('Z', '+00:00')) >= datetime.now()
        ])
        
        # Delete series
        params = {"delete_series": True}
        success, response, status = self.make_request('DELETE', f'appointments/{delete_appointment_id}', None, 200, params)
        if not success:
            self.log_test("Delete Series", False, f"Failed to delete series: {status}, {response}")
            return False
        
        # Verify future appointments are deleted
        success, appointments_after, status = self.make_request('GET', 'appointments', None, 200, params)
        if not success:
            self.log_test("Verify Series Delete", False, f"Failed to fetch appointments after deletion: {status}")
            return False
        
        future_count_after = len([
            apt for apt in appointments_after 
            if apt.get('recurring_id') == self.test_recurring_id and 
            datetime.fromisoformat(apt['date_time'].replace('Z', '+00:00')) >= datetime.now()
        ])
        
        deleted_count = future_count_before - future_count_after
        
        if deleted_count < 5:  # Should have deleted several future appointments
            self.log_test("Series Delete", False, f"Only {deleted_count} appointments deleted")
            return False
        
        # Verify past appointments remain
        past_count = len([
            apt for apt in appointments_after 
            if apt.get('recurring_id') == self.test_recurring_id and 
            datetime.fromisoformat(apt['date_time'].replace('Z', '+00:00')) < datetime.now()
        ])
        
        self.log_test("Series Delete", True, f"Deleted {deleted_count} future appointments, {past_count} past appointments remain")
        return True

    def test_single_appointment_operations(self):
        """Test Flow 4: Single Appointment Operations (P1)"""
        print("\n📅 Testing Single Appointment Operations...")
        
        # Create a NON-recurring appointment
        tomorrow = datetime.now() + timedelta(days=2)
        appointment_time = tomorrow.replace(hour=14, minute=30, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Single appointment test",
            "is_recurring": False,
            "pets": [
                {
                    "pet_name": "Bella",
                    "services": [self.test_service_id]
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if not success or response.get('is_recurring') != False:
            self.log_test("Create Single Appointment", False, f"Status: {status}, Response: {response}")
            return False
        
        self.test_single_appointment_id = response['id']
        self.log_test("Create Single Appointment", True)
        
        # Update the single appointment
        update_data = {
            "notes": "Updated single appointment note"
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{self.test_single_appointment_id}', update_data, 200)
        if not success or response.get('notes') != "Updated single appointment note":
            self.log_test("Update Single Appointment", False, f"Status: {status}")
            return False
        
        self.log_test("Update Single Appointment", True)
        
        # Delete the single appointment
        success, response, status = self.make_request('DELETE', f'appointments/{self.test_single_appointment_id}', None, 200)
        if not success:
            self.log_test("Delete Single Appointment", False, f"Status: {status}")
            return False
        
        # Verify it's deleted (should return 404)
        success, response, status = self.make_request('GET', f'appointments/{self.test_single_appointment_id}', None, 404)
        if success:  # success means we got the expected 404
            self.log_test("Verify Single Appointment Deleted", True)
            return True
        else:
            self.log_test("Verify Single Appointment Deleted", False, f"Expected 404, got {status}")
            return False

    def test_appointment_listing_with_filters(self):
        """Test Flow 5: Appointment Listing with Date Filters (P1)"""
        print("\n📋 Testing Appointment Listing with Date Filters...")
        
        # Test date range filtering for next month
        next_month_start = (datetime.now() + timedelta(days=30)).date()
        next_month_end = (datetime.now() + timedelta(days=60)).date()
        
        params = {
            "start_date": next_month_start.isoformat(),
            "end_date": next_month_end.isoformat()
        }
        
        success, appointments, status = self.make_request('GET', 'appointments', None, 200, params)
        if not success:
            self.log_test("Filter Appointments by Date Range", False, f"Status: {status}")
            return False
        
        # Verify all returned appointments are within the date range
        for apt in appointments:
            apt_date = datetime.fromisoformat(apt['date_time'].replace('Z', '+00:00')).date()
            if not (next_month_start <= apt_date <= next_month_end):
                self.log_test("Verify Date Range Filter", False, f"Appointment {apt['id']} outside date range")
                return False
        
        # Check that recurring appointments are included
        recurring_in_range = [apt for apt in appointments if apt.get('recurring_id') == self.test_recurring_id]
        
        self.log_test("Appointment Listing with Date Filters", True, 
                     f"Found {len(appointments)} appointments in range, {len(recurring_in_range)} recurring")
        return True

    def run_all_tests(self):
        """Run all recurring appointment tests"""
        print("🚀 Starting Recurring Appointments Critical Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Setup test data
        if not self.setup_test_data():
            print("❌ Failed to setup test data. Cannot continue.")
            return False

        # Run critical tests in order
        test_results = []
        
        print("\n" + "=" * 60)
        print("CRITICAL RECURRING APPOINTMENTS TESTS")
        print("=" * 60)
        
        # P0 Tests (Most Critical)
        test_results.append(self.test_recurring_appointments_creation())
        test_results.append(self.test_series_update())
        test_results.append(self.test_series_delete())
        
        # P1 Tests
        test_results.append(self.test_single_appointment_operations())
        test_results.append(self.test_appointment_listing_with_filters())

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        critical_tests_passed = sum(test_results[:3])  # First 3 are P0
        print(f"🔥 Critical Tests (P0): {critical_tests_passed}/3 passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed_tests = self.tests_run - self.tests_passed
            print(f"⚠️  {failed_tests} tests failed")
            
            # Show failed tests
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  ❌ {result['test']}: {result['details']}")
            
            return False

def main():
    tester = RecurringAppointmentsAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/recurring_appointments_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            'results': tester.test_results,
            'test_data': {
                'recurring_id': tester.test_recurring_id,
                'client_id': tester.test_client_id,
                'service_id': tester.test_service_id
            }
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())