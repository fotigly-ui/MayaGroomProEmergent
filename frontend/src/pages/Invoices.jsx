import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, Plus, Eye, Send, DollarSign, Clock, CheckCircle, XCircle, Printer } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('maya_token')}` }
});

export default function Invoices() {
  const { settings } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    client_id: '',
    items: [],
    notes: '',
    due_date: ''
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, clientsRes, servicesRes, itemsRes] = await Promise.all([
        axios.get(`${API_URL}/invoices?status=${statusFilter}`, getAuthHeaders()),
        axios.get(`${API_URL}/clients`, getAuthHeaders()),
        axios.get(`${API_URL}/services`, getAuthHeaders()),
        axios.get(`${API_URL}/items`, getAuthHeaders())
      ]);
      setInvoices(invoicesRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setItems(itemsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openNewInvoice = () => {
    setFormData({
      client_id: '',
      items: [{ name: '', quantity: 1, unit_price: 0, total: 0 }],
      notes: '',
      due_date: ''
    });
    setShowModal(true);
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, unit_price: 0, total: 0 }]
    }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Recalculate total
      if (field === 'quantity' || field === 'unit_price') {
        newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
      }
      
      return { ...prev, items: newItems };
    });
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const addServiceToInvoice = (service) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        name: service.name,
        quantity: 1,
        unit_price: service.price,
        total: service.price
      }]
    }));
  };

  const addItemToInvoice = (item) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        name: item.name,
        quantity: 1,
        unit_price: item.price,
        total: item.price
      }]
    }));
  };

  // Prices include GST - calculate GST portion from total (not add on top)
  const calculateTotals = () => {
    const total = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const gstRate = settings?.gst_enabled ? (settings?.gst_rate || 10) : 0;
    // GST is included in price, so calculate the GST portion
    // If GST is 10%, then GST = total * 10/110 = total / 11
    const gstAmount = gstRate > 0 ? (total * gstRate / (100 + gstRate)) : 0;
    const subtotal = total - gstAmount;
    return { subtotal, gstAmount, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    if (formData.items.length === 0 || !formData.items.some(i => i.name && i.total > 0)) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      const data = {
        client_id: formData.client_id,
        items: formData.items.filter(i => i.name && i.total > 0),
        notes: formData.notes,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null
      };
      
      await axios.post(`${API_URL}/invoices`, data, getAuthHeaders());
      toast.success('Invoice created');
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create invoice');
    }
  };

  const viewInvoice = async (invoice) => {
    try {
      const res = await axios.get(`${API_URL}/invoices/by-number/${invoice.invoice_number}`, getAuthHeaders());
      setSelectedInvoice(res.data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load invoice');
    }
  };

  const updateStatus = async (invoiceId, newStatus) => {
    try {
      const data = { status: newStatus };
      if (newStatus === 'paid') {
        data.paid_date = new Date().toISOString();
      }
      await axios.put(`${API_URL}/invoices/${invoiceId}`, data, getAuthHeaders());
      toast.success('Status updated');
      fetchData();
      if (selectedInvoice?.invoice?.id === invoiceId) {
        viewInvoice({ invoice_number: selectedInvoice.invoice.invoice_number });
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="text-maya-success" size={16} />;
      case 'sent': return <Send className="text-maya-info" size={16} />;
      case 'overdue': return <Clock className="text-maya-error" size={16} />;
      case 'cancelled': return <XCircle className="text-gray-400" size={16} />;
      default: return <FileText className="text-maya-warning" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const { subtotal, gstAmount, total } = calculateTotals();

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="Invoices" 
          subtitle={`${invoices.length} invoices`}
          action={
            <Button onClick={openNewInvoice} className="btn-maya-primary" data-testid="new-invoice-btn">
              <Plus size={18} className="mr-2" />
              New Invoice
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40" data-testid="status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoice List */}
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div 
              key={invoice.id} 
              className="card-maya flex items-center justify-between cursor-pointer hover:border-primary transition-colors"
              onClick={() => viewInvoice(invoice)}
              data-testid={`invoice-${invoice.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-maya-primary-light flex items-center justify-center">
                  {getStatusIcon(invoice.status)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-maya-text">{invoice.invoice_number}</h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", getStatusColor(invoice.status))}>
                      {invoice.status}
                    </span>
                  </div>
                  <p className="text-sm text-maya-text-muted">{invoice.client_name}</p>
                  <p className="text-xs text-maya-text-muted">
                    {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-primary">{formatCurrency(invoice.total)}</p>
                {invoice.due_date && (
                  <p className="text-xs text-maya-text-muted">
                    Due: {format(new Date(invoice.due_date), 'MMM d')}
                  </p>
                )}
              </div>
            </div>
          ))}

          {invoices.length === 0 && !loading && (
            <div className="empty-state">
              <FileText className="empty-state-icon mx-auto" />
              <p className="text-lg font-medium">No invoices yet</p>
              <p className="text-sm mt-1">Create your first invoice</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}>
                <SelectTrigger data-testid="invoice-client-select">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Add */}
            <div className="space-y-2">
              <Label>Quick Add Services/Items</Label>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <Button
                    key={service.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addServiceToInvoice(service)}
                  >
                    {service.name} ({formatCurrency(service.price)})
                  </Button>
                ))}
                {items.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addItemToInvoice(item)}
                  >
                    {item.name} ({formatCurrency(item.price)})
                  </Button>
                ))}
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
                  <Plus size={14} className="mr-1" /> Add Line
                </Button>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={item.name}
                      onChange={(e) => updateLineItem(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 text-right font-medium">
                    {formatCurrency(item.total)}
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItem(index)}
                      className="text-maya-error"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="bg-maya-cream rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-maya-text-muted">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {settings?.gst_enabled && (
                <div className="flex justify-between">
                  <span className="text-maya-text-muted">GST ({settings?.gst_rate || 10}%)</span>
                  <span>{formatCurrency(gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-maya-border pt-2">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Due Date & Notes */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Payment notes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="btn-maya-primary" data-testid="create-invoice-btn">
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-full print:m-0 print:shadow-none">
          {selectedInvoice && (
            <>
              <DialogHeader className="print:hidden pr-10">
                <DialogTitle>
                  Invoice {selectedInvoice.invoice.invoice_number}
                </DialogTitle>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={printInvoice}>
                    <Printer size={14} className="mr-1" /> Print
                  </Button>
                </div>
              </DialogHeader>

              {/* Invoice Content */}
              <div className="space-y-6 print:p-8" id="invoice-print">
                {/* Header */}
                <div className="flex justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-primary">{selectedInvoice.business.name || 'Business Name'}</h2>
                    {selectedInvoice.business.abn && <p className="text-sm text-maya-text-muted">ABN: {selectedInvoice.business.abn}</p>}
                    <p className="text-sm text-maya-text-muted">{selectedInvoice.business.address}</p>
                    <p className="text-sm text-maya-text-muted">{selectedInvoice.business.phone}</p>
                    <p className="text-sm text-maya-text-muted">{selectedInvoice.business.email}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xl font-bold">INVOICE</h3>
                    <p className="font-medium">{selectedInvoice.invoice.invoice_number}</p>
                    <p className="text-sm text-maya-text-muted">
                      Date: {format(new Date(selectedInvoice.invoice.created_at), 'MMM d, yyyy')}
                    </p>
                    {selectedInvoice.invoice.due_date && (
                      <p className="text-sm text-maya-text-muted">
                        Due: {format(new Date(selectedInvoice.invoice.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bill To */}
                <div className="border-t border-maya-border pt-4">
                  <p className="text-sm text-maya-text-muted mb-1">Bill To:</p>
                  <p className="font-semibold">{selectedInvoice.invoice.client_name}</p>
                  {selectedInvoice.invoice.client_address && <p className="text-sm">{selectedInvoice.invoice.client_address}</p>}
                  {selectedInvoice.invoice.client_phone && <p className="text-sm">{selectedInvoice.invoice.client_phone}</p>}
                  {selectedInvoice.invoice.client_email && <p className="text-sm">{selectedInvoice.invoice.client_email}</p>}
                </div>

                {/* Items Table */}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-maya-border">
                      <th className="text-left py-2">Description</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.invoice.items.map((item, i) => (
                      <tr key={i} className="border-b border-maya-border/50">
                        <td className="py-2">{item.name}</td>
                        <td className="text-center py-2">{item.quantity}</td>
                        <td className="text-right py-2">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-2">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedInvoice.invoice.subtotal)}</span>
                    </div>
                    {selectedInvoice.business.gst_enabled && selectedInvoice.invoice.gst_amount > 0 && (
                      <div className="flex justify-between">
                        <span>GST</span>
                        <span>{formatCurrency(selectedInvoice.invoice.gst_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t border-maya-border pt-2">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(selectedInvoice.invoice.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                {(selectedInvoice.business.bank_name || selectedInvoice.business.pay_id) && (
                  <div className="bg-maya-cream rounded-lg p-4 mt-6">
                    <p className="font-medium mb-2">Payment Details</p>
                    {selectedInvoice.business.pay_id && (
                      <p className="text-sm">PayID: {selectedInvoice.business.pay_id}</p>
                    )}
                    {selectedInvoice.business.bank_name && (
                      <>
                        <p className="text-sm">Bank: {selectedInvoice.business.bank_name}</p>
                        <p className="text-sm">BSB: {selectedInvoice.business.bsb}</p>
                        <p className="text-sm">Account: {selectedInvoice.business.account_number}</p>
                        <p className="text-sm">Name: {selectedInvoice.business.account_name}</p>
                      </>
                    )}
                  </div>
                )}

                {/* Notes */}
                {selectedInvoice.invoice.notes && (
                  <div className="text-sm text-maya-text-muted">
                    <p className="font-medium">Notes:</p>
                    <p>{selectedInvoice.invoice.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-maya-border print:hidden">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-1 rounded-full", getStatusColor(selectedInvoice.invoice.status))}>
                    {selectedInvoice.invoice.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {selectedInvoice.invoice.status === 'draft' && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus(selectedInvoice.invoice.id, 'sent')}>
                      <Send size={14} className="mr-1" /> Mark Sent
                    </Button>
                  )}
                  {['draft', 'sent', 'overdue'].includes(selectedInvoice.invoice.status) && (
                    <Button size="sm" className="btn-maya-primary" onClick={() => updateStatus(selectedInvoice.invoice.id, 'paid')}>
                      <CheckCircle size={14} className="mr-1" /> Mark Paid
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
