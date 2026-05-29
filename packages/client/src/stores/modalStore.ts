import { create } from 'zustand';

export type ModalType =
  | 'product_form'
  | 'product_delete'
  | 'inventory_adjust'
  | 'inventory_history'
  | 'employee_form'
  | 'employee_delete'
  | 'pos_product_search'
  | 'pos_manager_override'
  | 'pos_payment'
  | 'pos_suspended_carts'
  | 'pos_discount'
  | 'pos_receipt_preview'
  | 'pos_open_shift'
  | 'pos_close_shift'
  | 'pos_transaction_search'
  | 'pos_customer_select'
  | 'pos_quantity';

interface ModalState {
  activeModals: Record<ModalType, boolean>;
  modalPayloads: Record<ModalType, any>;
  openModal: (type: ModalType, payload?: any) => void;
  closeModal: (type: ModalType) => void;
  closeAll: () => void;
}

/**
 * Global store for modal states and payloads.
 * Decouples trigger components from modal containers and eliminates prop drilling.
 */
export const useModalStore = create<ModalState>((set) => ({
  activeModals: {
    product_form: false,
    product_delete: false,
    inventory_adjust: false,
    inventory_history: false,
    employee_form: false,
    employee_delete: false,
    pos_product_search: false,
    pos_manager_override: false,
    pos_payment: false,
    pos_suspended_carts: false,
    pos_discount: false,
    pos_receipt_preview: false,
    pos_open_shift: false,
    pos_close_shift: false,
    pos_transaction_search: false,
    pos_customer_select: false,
    pos_quantity: false,
  },
  modalPayloads: {
    product_form: null,
    product_delete: null,
    inventory_adjust: null,
    inventory_history: null,
    employee_form: null,
    employee_delete: null,
    pos_product_search: null,
    pos_manager_override: null,
    pos_payment: null,
    pos_suspended_carts: null,
    pos_discount: null,
    pos_receipt_preview: null,
    pos_open_shift: null,
    pos_close_shift: null,
    pos_transaction_search: null,
    pos_customer_select: null,
    pos_quantity: null,
  },

  openModal: (type, payload = null) =>
    set((state) => ({
      activeModals: { ...state.activeModals, [type]: true },
      modalPayloads: { ...state.modalPayloads, [type]: payload },
    })),

  closeModal: (type) =>
    set((state) => ({
      activeModals: { ...state.activeModals, [type]: false },
      // Note: We keep the payload present to avoid any visual text popping
      // during fade-out or exit transitions. It gets replaced next time openModal is run.
    })),

  closeAll: () =>
    set({
      activeModals: {
        product_form: false,
        product_delete: false,
        inventory_adjust: false,
        inventory_history: false,
        employee_form: false,
        employee_delete: false,
        pos_product_search: false,
        pos_manager_override: false,
        pos_payment: false,
        pos_suspended_carts: false,
        pos_discount: false,
        pos_receipt_preview: false,
        pos_open_shift: false,
        pos_close_shift: false,
        pos_transaction_search: false,
        pos_customer_select: false,
        pos_quantity: false,
      },
      modalPayloads: {
        product_form: null,
        product_delete: null,
        inventory_adjust: null,
        inventory_history: null,
        employee_form: null,
        employee_delete: null,
        pos_product_search: null,
        pos_manager_override: null,
        pos_payment: null,
        pos_suspended_carts: null,
        pos_discount: null,
        pos_receipt_preview: null,
        pos_open_shift: null,
        pos_close_shift: null,
        pos_transaction_search: null,
        pos_customer_select: null,
        pos_quantity: null,
      },
    }),
}));
