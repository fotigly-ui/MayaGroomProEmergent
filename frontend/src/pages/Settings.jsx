import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Building2, CreditCard, Bell, Clock } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: settings?.business_name || '',
    abn: settings?.abn || '',
    phone: settings?.phone || '',
    email: settings?.email || '',
    address: settings?.address || '',
    pay_id: settings?.pay_id || '',
    bank_name: settings?.bank_name || '',
    bsb: settings?.bsb || '',
    account_number: settings?.account_number || '',
    account_name: settings?.account_name || '',
    gst_enabled: settings?.gst_enabled || false,
    gst_rate: settings?.gst_rate || 10,
    use_24_hour_clock: settings?.use_24_hour_clock ?? true
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateSettings(formData);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl">
        <PageHeader 
          title="Settings" 
          subtitle="Manage your business preferences"
        />

        <Tabs defaultValue="business" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Building2 size={16} />
              <span className="hidden sm:inline">Business</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard size={16} />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Clock size={16} />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSave}>
            <TabsContent value="business">
              <div className="card-maya space-y-6">
                <h2 className="text-lg font-semibold text-maya-text">Business Information</h2>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input
                      value={formData.business_name}
                      onChange={(e) => updateField('business_name', e.target.value)}
                      placeholder="Your Business Name"
                      data-testid="settings-business-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ABN</Label>
                    <Input
                      value={formData.abn}
                      onChange={(e) => updateField('abn', e.target.value)}
                      placeholder="XX XXX XXX XXX"
                      data-testid="settings-abn"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="+61 X XXXX XXXX"
                      data-testid="settings-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="contact@business.com"
                      data-testid="settings-email"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Business address"
                      data-testid="settings-address"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payment">
              <div className="card-maya space-y-6">
                <h2 className="text-lg font-semibold text-maya-text">Payment Details</h2>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>PayID</Label>
                    <Input
                      value={formData.pay_id}
                      onChange={(e) => updateField('pay_id', e.target.value)}
                      placeholder="your@payid.com.au"
                      data-testid="settings-payid"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={formData.bank_name}
                      onChange={(e) => updateField('bank_name', e.target.value)}
                      placeholder="Bank name"
                      data-testid="settings-bank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BSB</Label>
                    <Input
                      value={formData.bsb}
                      onChange={(e) => updateField('bsb', e.target.value)}
                      placeholder="XXX-XXX"
                      data-testid="settings-bsb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={formData.account_number}
                      onChange={(e) => updateField('account_number', e.target.value)}
                      placeholder="XXXXXXXX"
                      data-testid="settings-account-number"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Account Name</Label>
                    <Input
                      value={formData.account_name}
                      onChange={(e) => updateField('account_name', e.target.value)}
                      placeholder="Account holder name"
                      data-testid="settings-account-name"
                    />
                  </div>
                </div>

                <div className="border-t border-maya-border pt-6">
                  <h3 className="text-md font-medium text-maya-text mb-4">GST Settings</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable GST</Label>
                      <p className="text-sm text-maya-text-muted">Include GST in invoices</p>
                    </div>
                    <Switch
                      checked={formData.gst_enabled}
                      onCheckedChange={(v) => updateField('gst_enabled', v)}
                      data-testid="settings-gst-toggle"
                    />
                  </div>
                  {formData.gst_enabled && (
                    <div className="mt-4 space-y-2">
                      <Label>GST Rate (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.gst_rate}
                        onChange={(e) => updateField('gst_rate', parseFloat(e.target.value) || 10)}
                        data-testid="settings-gst-rate"
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preferences">
              <div className="card-maya space-y-6">
                <h2 className="text-lg font-semibold text-maya-text">Display Preferences</h2>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>24-Hour Clock</Label>
                    <p className="text-sm text-maya-text-muted">Display times in 24-hour format</p>
                  </div>
                  <Switch
                    checked={formData.use_24_hour_clock}
                    onCheckedChange={(v) => updateField('use_24_hour_clock', v)}
                    data-testid="settings-24hr-toggle"
                  />
                </div>
              </div>
            </TabsContent>

            <div className="mt-6 flex justify-end">
              <Button 
                type="submit" 
                className="btn-maya-primary"
                disabled={loading}
                data-testid="save-settings-btn"
              >
                {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                Save Settings
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </Layout>
  );
}
