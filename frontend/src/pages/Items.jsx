import React, { useState, useEffect } from 'react';
import { Plus, Edit2, DollarSign, Package } from 'lucide-react';
import { Layout, PageHeader } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { itemsAPI } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: 0
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await itemsAPI.list();
      setItems(res.data);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setFormData({ name: item.name, price: item.price });
    } else {
      setEditing(null);
      setFormData({ name: '', price: 0 });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Item name is required');
      return;
    }

    try {
      if (editing) {
        await itemsAPI.update(editing.id, formData);
        toast.success('Item updated');
      } else {
        await itemsAPI.create(formData);
        toast.success('Item created');
      }
      setShowModal(false);
      fetchItems();
    } catch (error) {
      toast.error('Failed to save item');
    }
  };

  const handleDelete = async () => {
    if (!editing || !window.confirm('Delete this item?')) return;
    
    try {
      await itemsAPI.delete(editing.id);
      toast.success('Item deleted');
      setShowModal(false);
      fetchItems();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <PageHeader 
          title="Items" 
          subtitle="Retail products and add-ons"
          action={
            <Button onClick={() => openModal()} className="btn-maya-primary" data-testid="add-item-btn">
              <Plus size={18} className="mr-2" />
              Add Item
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="card-maya" data-testid={`item-card-${item.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-maya-primary-light flex items-center justify-center">
                    <Package className="text-primary" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-maya-text">{item.name}</h3>
                    <span className="text-primary font-medium">{formatCurrency(item.price)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openModal(item)}
                  data-testid={`edit-item-${item.id}`}
                >
                  <Edit2 size={16} />
                </Button>
              </div>
            </div>
          ))}

          {items.length === 0 && !loading && (
            <div className="col-span-full empty-state">
              <Package className="empty-state-icon mx-auto" />
              <p className="text-lg font-medium">No items yet</p>
              <p className="text-sm mt-1">Add retail products to sell during appointments</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'New Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Shampoo, Nail Caps"
                data-testid="item-name-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Price (AUD)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                data-testid="item-price-input"
              />
            </div>
            <DialogFooter className="gap-2">
              {editing && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-maya-primary" data-testid="save-item-btn">
                {editing ? 'Update' : 'Create'} Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
