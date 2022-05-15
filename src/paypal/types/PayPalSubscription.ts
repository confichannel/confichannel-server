export interface PayPalSubscription {
	id: string;
	status: string;
	status_update_time: string;
	plan_id: string;
	custom_id?: string;
	start_time: string;
	quantity: string;
	shipping_amount: { currency_code: string; value: string };
	subscriber: {
		name: any;
		email_address: string;
		shipping_address: any;
	};
	auto_renewal: true;
	billing_info: {
		outstanding_balance: any;
		cycle_executions: any[];
		last_payment: any[];
		next_billing_time: string;
		final_payment_time: string;
		failed_payments_count: number;
	};
	create_time: string;
	update_time: string;
	links: any[];
}
