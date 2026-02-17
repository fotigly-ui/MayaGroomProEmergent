#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class FrequencyChangeTester:
    def __init__(self, base_url="https://grooming-hub-49.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        
        # Test data storage
        self.test_client_id = None
        self.test_service_id = None

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make API request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            return success, response.json() if success else response.text, response.status_code

        except Exception as e:
            return False, str(e), 0

    def setup_auth_and_data(self):
        """Setup authentication and test data"""
        # Login
        data = {
            "email": "frontendtest@test.com",
            "password": "test123"
        }
        
        success, response, status = self.make_request('POST', 'auth/login', data, 200)
        if success and 'access_token' in response:
            self.token = response['access_token']
            print("✅ Authentication successful")
        else:
            print(f"❌ Authentication failed: {status}")
            return False

        # Get user info
        success, response, status = self.make_request('GET', 'auth/me', None, 200)
        if success and 'id' in response:
            self.user_id = response['id']
        else:
            print(f"❌ Failed to get user info: {status}")
            return False

        # Get existing client and service
        success, clients, status = self.make_request('GET', 'clients', None, 200)
        if success and len(clients) > 0:
            self.test_client_id = clients[0]['id']
            print(f"✅ Using existing client: {clients[0]['name']}")
        else:
            print(f"❌ No clients found: {status}")
            return False

        success, services, status = self.make_request('GET', 'services', None, 200)
        if success and len(services) > 0:
            self.test_service_id = services[0]['id']
            print(f"✅ Using existing service: {services[0]['name']}")
        else:
            print(f"❌ No services found: {status}")
            return False

        return True

    def test_frequency_change(self):
        """Test series update with frequency change"""
        print("\n🔄 Testing Series Update with Frequency Change...")
        
        # Create weekly recurring appointment
        start_date = datetime.now() + timedelta(days=14)
        appointment_time = start_date.replace(hour=16, minute=0, second=0, microsecond=0)
        
        data = {
            "client_id": self.test_client_id,
            "date_time": appointment_time.isoformat(),
            "notes": "Weekly recurring for frequency change test",
            "is_recurring": True,
            "recurring_value": 1,
            "recurring_unit": "week",
            "pets": [
                {
                    "pet_name": "Charlie",
                    "services": [self.test_service_id],
                    "items": []
                }
            ]
        }
        
        success, response, status = self.make_request('POST', 'appointments', data, 200)
        if not success:
            print(f"❌ Could not create test appointment: {status}")
            return False
            
        test_recurring_id = response.get('recurring_id')
        test_appointment_id = response.get('id')
        print(f"✅ Created weekly recurring series with ID: {test_recurring_id}")
        
        # Get count of original series
        original_success, original_appointments, _ = self.make_request('GET', 'appointments', None, 200)
        if original_success:
            original_series = [apt for apt in original_appointments if apt.get('recurring_id') == test_recurring_id]
            original_count = len(original_series)
            print(f"📊 Original series has {original_count} appointments")
        else:
            print("❌ Could not get original series count")
            return False
        
        # Update frequency from weekly to bi-weekly
        update_data = {
            "is_recurring": True,
            "recurring_value": 2,
            "recurring_unit": "week",
            "notes": "Changed to bi-weekly frequency",
            "update_series": True
        }
        
        success, response, status = self.make_request('PUT', f'appointments/{test_appointment_id}', update_data, 200)
        if success:
            # Verify the appointment has new frequency
            if (response.get('recurring_value') == 2 and 
                response.get('recurring_unit') == 'week' and
                response.get('notes') == "Changed to bi-weekly frequency"):
                print("✅ Appointment updated with new frequency")
                
                # Verify new series was created with correct intervals
                new_success, new_appointments, _ = self.make_request('GET', 'appointments', None, 200)
                if new_success:
                    new_series = [apt for apt in new_appointments if apt.get('recurring_id') == test_recurring_id]
                    new_count = len(new_series)
                    print(f"📊 New series has {new_count} appointments")
                    
                    # Should have fewer appointments due to bi-weekly frequency
                    if new_count < original_count:
                        print(f"✅ Series count reduced correctly: {original_count} -> {new_count}")
                        
                        # Verify 2-week intervals
                        sorted_appointments = sorted(new_series, key=lambda x: x['date_time'])
                        if len(sorted_appointments) >= 2:
                            first_date = datetime.fromisoformat(sorted_appointments[0]['date_time'].replace('Z', '+00:00'))
                            second_date = datetime.fromisoformat(sorted_appointments[1]['date_time'].replace('Z', '+00:00'))
                            interval_days = (second_date - first_date).days
                            
                            if interval_days == 14:  # 2 weeks = 14 days
                                print(f"✅ CRITICAL TEST PASSED - Series Update with Frequency Change")
                                print(f"   📋 Successfully changed from weekly to bi-weekly: {original_count} -> {new_count} appointments, 14-day intervals")
                                return True
                            else:
                                print(f"❌ Incorrect interval: {interval_days} days instead of 14")
                                return False
                        else:
                            print("❌ Not enough appointments to verify interval")
                            return False
                    else:
                        print(f"❌ Series count did not decrease: {original_count} -> {new_count}")
                        return False
                else:
                    print("❌ Could not get updated series")
                    return False
            else:
                print("❌ Frequency not updated correctly")
                return False
        else:
            print(f"❌ Update failed: {status}")
            return False

    def run_test(self):
        """Run the frequency change test"""
        print("🚀 Starting Series Frequency Change Test...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)

        if not self.setup_auth_and_data():
            print("❌ Setup failed. Cannot continue test.")
            return False

        return self.test_frequency_change()

def main():
    tester = FrequencyChangeTester()
    success = tester.run_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())