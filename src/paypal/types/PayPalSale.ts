export interface PayPalSale {
	id: string;
	create_time: string;
	resource_type: string;
	custom_id?: string;
	event_type: string;
	summary: string;
	resource: {
		parent_payment: string;
		update_time: string;
		amount: {
			total: string;
			currency: string;
		};
		payment_mode: string;
		create_time: string;
		clearing_time: string;
		protection_eligibility_type: string;
		protection_eligibility: string;
		links: any[];
		id: string;
		state: string;
	};
	links: any[];
	event_version: string;
}
