
export enum StorageType {
  OUTSIDE = 'fora da geladeira',
  FRIDGE = 'geladeira',
  FREEZER = 'freezer',
  PANTRY = 'despensa'
}

export enum FoodStatus {
  ACTIVE = 'active',
  EXPIRED = 'vencido',
  SPOILED = 'estragado',
  CONSUMED = 'consumido'
}

export type ShoppingPriority = 'Urgente' | 'Normal' | 'Baixa';

export interface FoodItem {
  id: string;
  name: string;
  initialQuantity: number;
  currentQuantity: number;
  unit: string;
  storageType: StorageType;
  expiryDate: string; // ISO String
  createdAt: string; // ISO String
  status: FoodStatus;
  estimatedValue: number; // For loss calculation
}

export interface ShoppingListItem {
  id: string;
  name: string;
  suggestedQuantity: number;
  unit: string;
  reason: 'finished' | 'spoiled' | 'manual' | 'expired';
  priority: ShoppingPriority;
}

export interface UserProfile {
  name: string;
  plan: 'free' | 'premium';
  alertDaysBefore: number;
}

export interface AppState {
  user: UserProfile;
  inventory: FoodItem[];
  shoppingList: ShoppingListItem[];
  events: any[]; // History of actions
}
