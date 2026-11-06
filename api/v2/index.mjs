import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
//#region src/motorist/model.ts
var vehicleTypes = [
	"Sedan",
	"SUV",
	"Pickup",
	"Motorcycle",
	"Van"
];
var services = [
	{
		name: "Tow Truck",
		icon: "truck",
		description: "Vehicle transport and recovery",
		base: 1200
	},
	{
		name: "Jump Start",
		icon: "wrench",
		description: "Restart a drained battery",
		base: 650
	},
	{
		name: "Flat Tire",
		icon: "car",
		description: "Tire replacement assistance",
		base: 800
	},
	{
		name: "Fuel Refill",
		icon: "fuel",
		description: "Emergency fuel delivery",
		base: 500
	},
	{
		name: "Emergency Tow",
		icon: "sos",
		description: "Priority towing request",
		base: 1200
	}
];
var incidents = [
	"Engine failure",
	"Accident",
	"Flat tire",
	"Battery problem",
	"Overheating",
	"Other"
];
var providers = [{
	id: "viray",
	name: "Viray Towing Services",
	area: "Cubao, Quezon City",
	eta: "8–12 min",
	rating: "4.9",
	initials: "VT",
	adjustment: 0
}, {
	id: "motor-trust",
	name: "Motor Trust Towing",
	area: "Ortigas Center",
	eta: "14–18 min",
	rating: "4.8",
	initials: "MT",
	adjustment: 100
}];
var isTow = (service) => service === "Tow Truck" || service === "Emergency Tow";
var normalizePlate = (plate) => plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
function quoteFor(service, providerId) {
	const base = services.find((item) => item.name === service)?.base ?? 1200;
	const travel = isTow(service) ? 390 : 0;
	const fee = 95;
	const provider = providers.find((item) => item.id === providerId)?.adjustment ?? 0;
	return {
		base,
		travel,
		fee,
		provider,
		total: base + travel + fee + provider
	};
}
function validateVehicle(vehicle, vehicles) {
	const errors = {};
	for (const field of [
		"make",
		"model",
		"color"
	]) if (!vehicle[field].trim()) errors[field] = `Enter the vehicle ${field}.`;
	if (!/^\d{4}$/.test(vehicle.year) || Number(vehicle.year) < 1900 || Number(vehicle.year) > (/* @__PURE__ */ new Date()).getFullYear() + 1) errors.year = "Enter a valid four-digit model year.";
	if (!vehicleTypes.includes(vehicle.type)) errors.type = "Choose a vehicle type.";
	if (!/^[A-Z0-9 -]{3,12}$/i.test(vehicle.plate.trim()) || normalizePlate(vehicle.plate).length < 3) errors.plate = "Enter a plate or temporary registration (3–12 letters, numbers, spaces or hyphens).";
	else if (vehicles.some((item) => item.id !== vehicle.id && normalizePlate(item.plate) === normalizePlate(vehicle.plate))) errors.plate = "This plate is already saved. Edit the existing vehicle instead.";
	return errors;
}
function validateStep(step, draft, vehicles) {
	if (step === 1 && !vehicles.some((vehicle) => vehicle.id === draft.vehicleId)) return "Choose a saved vehicle or add one to continue.";
	if (step === 2) {
		if (!incidents.includes(draft.incident)) return "Choose the incident that best describes the problem.";
		if (draft.incident === "Other" && !draft.notes.trim()) return "Describe the problem so the provider knows what assistance you need.";
		if (draft.notes.length > 500) return "Keep notes within 500 characters.";
	}
	if (step === 3) {
		if (draft.pickup.trim().length < 5) return "Enter a pickup address with at least five characters.";
		if (isTow(draft.service) && draft.destination.trim().length < 5) return "Enter a destination address with at least five characters.";
		if (isTow(draft.service) && draft.pickup.trim().toLowerCase() === draft.destination.trim().toLowerCase()) return "Pickup and destination must be different.";
	}
	if (step === 4 && !providers.some((provider) => provider.id === draft.providerId)) return "Choose a provider to continue.";
}
function makeBooking(draft, vehicles) {
	for (let step = 1; step <= 4; step++) {
		const error = validateStep(step, draft, vehicles);
		if (error) throw new Error(error);
	}
	const { vehicleId, ...details } = draft;
	return {
		...details,
		pickup: draft.pickup.trim(),
		destination: isTow(draft.service) ? draft.destination.trim() : "Assistance at pickup",
		notes: draft.notes.trim(),
		id: `LT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
		vehicle: { ...vehicles.find((vehicle) => vehicle.id === vehicleId) },
		providerName: providers.find((provider) => provider.id === draft.providerId).name,
		quote: quoteFor(draft.service, draft.providerId),
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		status: "searching",
		stage: 0
	};
}
var isVehicle = (value) => {
	if (!value || typeof value !== "object") return false;
	const vehicle = value;
	return [
		"id",
		"make",
		"model",
		"year",
		"type",
		"color",
		"plate"
	].every((key) => typeof vehicle[key] === "string") && !Object.keys(validateVehicle(vehicle, [])).length;
};
//#endregion
//#region src/motorist/profileModel.ts
function normalizePhone(phone) {
	const compact = phone.trim().replace(/[\s()-]/g, "");
	if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
	if (/^9\d{9}$/.test(compact)) return `+63${compact}`;
	if (/^639\d{9}$/.test(compact)) return `+${compact}`;
	return compact;
}
function cleanProfile(profile) {
	return {
		name: profile.name.trim().replace(/\s+/g, " "),
		email: profile.email.trim(),
		phone: normalizePhone(profile.phone)
	};
}
function validateProfile(profile) {
	const value = cleanProfile(profile);
	const errors = {};
	if (value.name.length < 2 || value.name.length > 80) errors.name = "Enter a name between 2 and 80 characters.";
	if (value.email && (value.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) errors.email = "Enter a valid email address, or leave this optional field blank.";
	if (value.phone && !/^\+639\d{9}$/.test(value.phone)) errors.phone = "Enter a Philippine mobile number, such as 09 followed by 9 digits, or leave it blank.";
	return errors;
}
//#endregion
//#region src/shared/dispatch.ts
var demoActors = [
	{
		id: "motorist-demo",
		name: "Demo motorist",
		role: "motorist"
	},
	{
		id: "operator-viray",
		name: "Marco Reyes",
		role: "operator",
		providerId: "viray",
		truck: "Flatbed · VT 001"
	},
	{
		id: "operator-viray-2",
		name: "Ana Santos",
		role: "operator",
		providerId: "viray",
		truck: "Flatbed · VT 002"
	},
	{
		id: "operator-motor-trust",
		name: "Luis Cruz",
		role: "operator",
		providerId: "motor-trust",
		truck: "Flatbed · MT 001"
	},
	{
		id: "company-viray",
		name: "Viray dispatch",
		role: "company",
		providerId: "viray"
	},
	{
		id: "company-motor-trust",
		name: "Motor Trust dispatch",
		role: "company",
		providerId: "motor-trust"
	},
	{
		id: "central-demo",
		name: "LigtasTow operations",
		role: "central"
	}
];
var isActive = (booking) => booking.status === "searching" || booking.status === "assigned";
function bookingStages(service) {
	return [
		"Request received",
		"Operator assigned",
		"Operator en route",
		"Operator arrived",
		"Vehicle inspection",
		service === "Tow Truck" || service === "Emergency Tow" ? "Vehicle loaded" : "Assistance provided"
	];
}
function progressLabel(booking) {
	if (booking.status === "completed") return "Service completed";
	if (booking.status === "cancelled") return "Request cancelled";
	if (booking.status === "searching") return "Awaiting operator";
	return bookingStages(booking.service)[booking.stage];
}
//#endregion
//#region server/dispatchService.ts
var ApiError = class extends Error {
	status;
	code;
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
};
function fail(status, code, message) {
	throw new ApiError(status, code, message);
}
var emptyDatabase = () => ({
	schemaVersion: 1,
	bookings: [],
	creations: {}
});
var object = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var DispatchService = class {
	database;
	file;
	actors;
	constructor(file, seed) {
		this.file = file;
		this.database = emptyDatabase();
		this.actors = seed?.actors ?? demoActors;
		if (seed) this.database.bookings = structuredClone(seed.bookings);
		if (file) try {
			const data = JSON.parse(readFileSync(file, "utf8"));
			if (data.schemaVersion !== 1 || !Array.isArray(data.bookings) || !object(data.creations) || !data.bookings.every((b) => object(b) && typeof b.id === "string" && Number.isInteger(b.version) && Array.isArray(b.events) && Array.isArray(b.declinedOperatorIds) && isVehicle(b.vehicle))) throw new Error("Invalid dispatch database schema");
			this.database = data;
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	commit(next) {
		if (this.file) {
			mkdirSync(dirname(this.file), { recursive: true });
			const temporary = `${this.file}.tmp`;
			writeFileSync(temporary, JSON.stringify(next, null, 2), {
				encoding: "utf8",
				mode: 384
			});
			renameSync(temporary, this.file);
		}
		this.database = next;
	}
	visible(actor, booking) {
		if (actor.role === "central") return true;
		if (actor.role === "motorist") return actor.id === booking.motoristId;
		if (actor.providerId !== booking.providerId) return false;
		return actor.role === "company" || booking.operatorId === actor.id || booking.status === "searching" && !booking.declinedOperatorIds.includes(actor.id);
	}
	snapshot(actor) {
		return structuredClone({
			bookings: this.database.bookings.filter((b) => this.visible(actor, b)),
			operators: actor.role === "motorist" ? [] : this.actors.filter((a) => a.role === "operator" && (actor.role === "central" || a.providerId === actor.providerId))
		});
	}
	create(actor, input) {
		if (actor.role !== "motorist") fail(403, "FORBIDDEN", "Only a motorist can request assistance.");
		if (!object(input) || !object(input.draft) || !isVehicle(input.vehicle) || typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId)) fail(400, "INVALID_REQUEST", "Provide a valid request identifier, vehicle and booking details.");
		const raw = input.draft;
		for (const key of [
			"service",
			"vehicleId",
			"incident",
			"notes",
			"pickup",
			"destination",
			"providerId"
		]) if (typeof raw[key] !== "string") fail(400, "INVALID_REQUEST", `Missing or invalid ${key}.`);
		if (!services.some((s) => s.name === raw.service) || raw.pickup.length > 180 || raw.destination.length > 180) fail(400, "INVALID_REQUEST", "Choose a supported service and addresses up to 180 characters.");
		const draft = Object.fromEntries([
			"service",
			"vehicleId",
			"incident",
			"notes",
			"pickup",
			"destination",
			"providerId"
		].map((key) => [key, raw[key]]));
		if (draft.vehicleId !== input.vehicle.id) fail(400, "INVALID_REQUEST", "The selected vehicle does not match the request.");
		const payload = JSON.stringify({
			draft,
			vehicle: input.vehicle
		});
		const key = `${actor.id}:${input.requestId}`;
		const prior = this.database.creations[key];
		if (prior) {
			if (prior.payload !== payload) fail(409, "IDEMPOTENCY_CONFLICT", "This request identifier was already used for different details.");
			return structuredClone(this.database.bookings.find((b) => b.id === prior.bookingId));
		}
		if (this.database.bookings.some((b) => b.motoristId === actor.id && isActive(b))) fail(409, "ACTIVE_BOOKING", "You already have an active request. Open History to continue it.");
		let base;
		try {
			base = makeBooking(draft, [input.vehicle]);
		} catch (error) {
			fail(400, "INVALID_REQUEST", error instanceof Error ? error.message : "Review the booking details.");
		}
		const booking = {
			...base,
			id: `LT-${randomUUID()}`,
			motoristId: actor.id,
			version: 1,
			updatedAt: base.createdAt,
			declinedOperatorIds: [],
			events: []
		};
		this.event(booking, actor, "created", "Request received by the selected provider.");
		this.commit({
			...this.database,
			bookings: [booking, ...this.database.bookings],
			creations: {
				...this.database.creations,
				[key]: {
					bookingId: booking.id,
					payload
				}
			}
		});
		return structuredClone(booking);
	}
	event(booking, actor, action, detail) {
		booking.events.push({
			id: randomUUID(),
			at: booking.updatedAt,
			actorId: actor.userId ?? actor.id,
			actorName: actor.name,
			action,
			detail
		});
	}
	command(actor, id, input) {
		const current = this.database.bookings.find((b) => b.id === id);
		if (!current || !this.visible(actor, current)) fail(404, "NOT_FOUND", "This booking is unavailable for the selected workspace.");
		if (!object(input) || !Number.isInteger(input.expectedVersion) || typeof input.action !== "string") fail(400, "INVALID_REQUEST", "Provide an action and the current booking version.");
		if (current.version !== input.expectedVersion) fail(409, "STALE_VERSION", "This booking changed. Refresh it before trying again.");
		const command = input;
		const booking = structuredClone(current);
		let detail = "";
		const manager = actor.role === "company" || actor.role === "central";
		if (command.action === "accept" || command.action === "assign") {
			if (command.action === "accept" ? actor.role !== "operator" : !manager) fail(403, "FORBIDDEN", "This workspace cannot assign an operator.");
			if (booking.status !== "searching") fail(409, "INVALID_STATE", "Only a waiting request can be assigned.");
			const operator = this.actors.find((a) => a.id === (command.action === "accept" ? actor.id : command.operatorId) && a.role === "operator" && a.providerId === booking.providerId);
			if (!operator || booking.declinedOperatorIds.includes(operator.id)) fail(400, "INVALID_OPERATOR", "Choose an eligible operator from this provider.");
			if (this.database.bookings.some((b) => b.operatorId === operator.id && isActive(b))) fail(409, "OPERATOR_BUSY", "This operator already has an active job.");
			booking.operatorId = operator.id;
			booking.operatorName = operator.name;
			booking.status = "assigned";
			booking.stage = 1;
			detail = `Assigned to ${operator.name}.`;
		} else if (command.action === "decline") {
			if (actor.role !== "operator") fail(403, "FORBIDDEN", "Only an operator can decline an offer.");
			if (booking.status !== "searching") fail(409, "INVALID_STATE", "Only a waiting offer can be declined.");
			booking.declinedOperatorIds.push(actor.id);
			detail = "Offer declined; request remains available to other eligible operators.";
		} else if (command.action === "advance") {
			if (actor.role !== "operator" || actor.id !== booking.operatorId) fail(403, "FORBIDDEN", "Only the assigned operator can update progress.");
			if (booking.status !== "assigned") fail(409, "INVALID_STATE", "Only an assigned job can progress.");
			if (booking.stage === bookingStages(booking.service).length - 1) booking.status = "completed";
			else booking.stage += 1;
			detail = progressLabel(booking);
		} else if (command.action === "cancel") {
			if (actor.role !== "motorist" && !manager) fail(403, "FORBIDDEN", "Contact your dispatcher to cancel this job.");
			if (!isActive(booking)) fail(409, "INVALID_STATE", "This request has already ended.");
			if (actor.role === "motorist" && booking.stage >= 4) fail(409, "CANCELLATION_REVIEW", "Service has started. Ask the dispatcher to review cancellation.");
			if (typeof command.reason !== "string" || !command.reason.trim() || command.reason.trim().length > 300) fail(400, "INVALID_REASON", "Enter a cancellation reason between 1 and 300 characters.");
			booking.status = "cancelled";
			booking.cancellationReason = command.reason.trim();
			detail = booking.cancellationReason;
		} else if (command.action === "rate") {
			if (actor.role !== "motorist") fail(403, "FORBIDDEN", "Only the requesting motorist can rate the service.");
			if (booking.status !== "completed") fail(409, "INVALID_STATE", "Ratings are available after service completion.");
			if (!Number.isInteger(command.rating) || command.rating < 1 || command.rating > 5) fail(400, "INVALID_RATING", "Choose a rating between 1 and 5.");
			booking.rating = command.rating;
			detail = `Service rated ${command.rating}/5.`;
		} else fail(400, "INVALID_ACTION", "Unknown booking action.");
		booking.version += 1;
		booking.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
		this.event(booking, actor, command.action, detail);
		this.commit({
			...this.database,
			bookings: this.database.bookings.map((b) => b.id === id ? booking : b)
		});
		return structuredClone(booking);
	}
};
//#endregion
//#region server/postgresDispatch.ts
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var record = (input) => !!input && typeof input === "object" && !Array.isArray(input);
function invalid(message) {
	throw new ApiError(400, "INVALID_REQUEST", message);
}
function missing() {
	throw new ApiError(404, "NOT_FOUND", "This record is unavailable for your account or workspace.");
}
var dbId = (id) => {
	const value = id.startsWith("LT-") ? id.slice(3) : id;
	if (!uuid.test(value)) missing();
	return value.toLowerCase();
};
var date = (value) => new Date(value).toISOString();
var vehicleRow = (row) => ({
	id: row.id,
	make: row.make,
	model: row.model,
	year: String(row.year),
	type: row.type,
	color: row.color,
	plate: row.plate
});
async function workspaces(client, user) {
	const { rows: [profile] } = await client.query("select display_name from public.profiles where id=$1", [user.id]);
	if (!profile) throw new ApiError(409, "PROFILE_MISSING", "Your account profile is not ready. Ask the project owner to check the database migration.");
	const result = [];
	const { rows } = await client.query(`select m.provider_id, m.role, p.name as provider_name,
    o.id as operator_id, o.display_name, o.truck_label, o.active as operator_active
    from public.provider_memberships m join public.providers p on p.id=m.provider_id
    left join public.operators o on o.membership_id=m.id where m.user_id=$1 and m.active`, [user.id]);
	for (const row of rows) {
		if (row.role === "company") result.push({
			key: `company:${row.provider_id}`,
			actor: {
				id: user.id,
				userId: user.id,
				role: "company",
				name: row.provider_name,
				providerId: row.provider_id
			}
		});
		if (row.role === "operator" && row.operator_active) result.push({
			key: `operator:${row.operator_id}`,
			actor: {
				id: row.operator_id,
				userId: user.id,
				role: "operator",
				name: row.display_name,
				providerId: row.provider_id,
				truck: row.truck_label
			}
		});
	}
	if ((await client.query("select 1 from app_private.central_admins where user_id=$1 and active", [user.id])).rows.length) result.push({
		key: "central",
		actor: {
			id: user.id,
			userId: user.id,
			name: profile.display_name,
			role: "central"
		}
	});
	if (result.length === 0) result.unshift({
		key: "motorist",
		actor: {
			id: user.id,
			userId: user.id,
			name: profile.display_name,
			role: "motorist"
		}
	});
	return result;
}
async function actorFor(client, user, workspace) {
	const actor = (await workspaces(client, user)).find((item) => item.key === workspace)?.actor;
	if (!actor) throw new ApiError(403, "WORKSPACE_FORBIDDEN", "This workspace is not assigned to your account. Sign in again to refresh your access.");
	return actor;
}
async function roster(client, actor) {
	if (actor.role === "motorist") return [];
	const { rows } = await client.query(`select o.*, m.user_id from public.operators o
    join public.provider_memberships m on m.id=o.membership_id
    where o.active and m.active and ($1::text is null or o.provider_id=$1) order by o.display_name`, [actor.role === "central" ? null : actor.providerId]);
	return rows.map((row) => ({
		id: row.id,
		userId: row.user_id,
		name: row.display_name,
		role: "operator",
		providerId: row.provider_id,
		truck: row.truck_label
	}));
}
async function bookings(client, where, values) {
	const { rows } = await client.query(`select b.*, o.display_name as operator_name, r.rating,
    coalesce((select jsonb_agg(d.operator_id order by d.created_at, d.operator_id) from public.booking_declines d where d.booking_id=b.id), '[]') as declines,
    coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'at', e.created_at, 'actorId', e.actor_user_id,
      'actorName', e.actor_name_snapshot, 'action', e.action, 'detail', e.detail) order by e.booking_version)
      from public.booking_events e where e.booking_id=b.id), '[]') as events
    from public.bookings b left join public.operators o on o.id=b.operator_id
    left join public.booking_ratings r on r.booking_id=b.id where ${where} order by b.created_at desc, b.id`, values);
	return rows.map((row) => ({
		id: `LT-${row.id}`,
		motoristId: row.motorist_id,
		providerId: row.provider_id,
		providerName: row.provider_name_snapshot,
		operatorId: row.operator_id ?? void 0,
		operatorName: row.operator_name ?? void 0,
		service: row.service,
		vehicle: row.vehicle_snapshot,
		incident: row.incident,
		notes: row.notes,
		pickup: row.pickup,
		destination: row.destination,
		status: row.status,
		stage: row.stage,
		version: row.version,
		createdAt: date(row.created_at),
		updatedAt: date(row.updated_at),
		cancellationReason: row.cancellation_reason ?? void 0,
		rating: row.rating ?? void 0,
		declinedOperatorIds: row.declines,
		events: row.events,
		quote: {
			base: Number(row.base_centavos) / 100,
			travel: Number(row.travel_centavos) / 100,
			provider: Number(row.provider_centavos) / 100,
			fee: Number(row.platform_centavos) / 100,
			total: Number(row.total_centavos) / 100
		}
	}));
}
async function addEvent(client, booking) {
	const event = booking.events[booking.events.length - 1];
	await client.query(`insert into public.booking_events(id, booking_id, booking_version, actor_user_id, actor_name_snapshot, action, detail, created_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`, [
		event.id,
		dbId(booking.id),
		booking.version,
		event.actorId,
		event.actorName,
		event.action,
		event.detail,
		event.at
	]);
}
var PostgresDispatch = class {
	transaction;
	constructor(transaction) {
		this.transaction = transaction;
	}
	async run(work) {
		try {
			return await this.transaction(work);
		} catch (error) {
			const code = error.code;
			if (code === "23505") throw new ApiError(409, "CONFLICT", "A matching vehicle, active booking or operator assignment already exists. Refresh and try again.");
			if ([
				"40001",
				"40P01",
				"55P03"
			].includes(code ?? "")) throw new ApiError(409, "RETRY_TRANSACTION", "Another update is being saved. Refresh and retry this action.");
			throw error;
		}
	}
	session(user) {
		return this.run(async (client) => {
			const available = await workspaces(client, user);
			const { rows: [profile] } = await client.query("select display_name, phone, booking_updates from public.profiles where id=$1", [user.id]);
			const vehicles = await client.query("select * from public.vehicles where owner_id=$1 order by created_at, id", [user.id]);
			const providerRows = await client.query("select id, name, area from public.providers where active and id=any($1::text[]) order by name", [providers.map((item) => item.id)]);
			return {
				userId: user.id,
				profile: {
					name: profile.display_name,
					email: user.email,
					phone: profile.phone ?? ""
				},
				bookingUpdates: profile.booking_updates,
				vehicles: vehicles.rows.map(vehicleRow),
				workspaces: available,
				providers: providerRows.rows
			};
		});
	}
	snapshot(user, workspace) {
		return this.run(async (client) => {
			const actor = await actorFor(client, user, workspace);
			let where, args;
			if (actor.role === "central") {
				where = "true";
				args = [];
			} else if (actor.role === "motorist") {
				where = "b.motorist_id=$1";
				args = [user.id];
			} else if (actor.role === "company") {
				where = "b.provider_id=$1";
				args = [actor.providerId];
			} else {
				where = `b.provider_id=$1 and (b.operator_id=$2 or (b.status='searching' and not exists
          (select 1 from public.booking_declines d where d.booking_id=b.id and d.operator_id=$2)))`;
				args = [actor.providerId, actor.id];
			}
			return {
				bookings: await bookings(client, where, args),
				operators: await roster(client, actor)
			};
		});
	}
	create(user, workspace, input) {
		return this.run(async (client) => {
			const actor = await actorFor(client, user, workspace);
			if (actor.role !== "motorist") throw new ApiError(403, "FORBIDDEN", "Only a motorist can request assistance.");
			if (!record(input) || !record(input.draft) || typeof input.requestId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId)) invalid("Provide a valid booking request and identifier.");
			const raw = input.draft;
			const keys = [
				"service",
				"vehicleId",
				"incident",
				"notes",
				"pickup",
				"destination",
				"providerId"
			];
			if (!keys.every((key) => typeof raw[key] === "string") || !uuid.test(raw.vehicleId)) invalid("Choose a saved vehicle and complete the booking details.");
			const draft = Object.fromEntries(keys.map((key) => [key, raw[key]]));
			const payload = { draft };
			await client.query("select id from public.profiles where id=$1 for update", [user.id]);
			const { rows: [prior] } = await client.query("select booking_id, payload from app_private.booking_requests where motorist_id=$1 and request_id=$2", [user.id, input.requestId]);
			if (prior) {
				if (!isDeepStrictEqual(prior.payload, payload)) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This request identifier was used for different booking details.");
				return (await bookings(client, "b.id=$1 and b.motorist_id=$2", [prior.booking_id, user.id]))[0];
			}
			const { rows: [vehicle] } = await client.query("select * from public.vehicles where id=$1 and owner_id=$2 for share", [draft.vehicleId, user.id]);
			if (!vehicle) invalid("Choose a vehicle saved in your account.");
			const { rows: [provider] } = await client.query("select name from public.providers where id=$1 and active for share", [draft.providerId]);
			if (!provider) throw new ApiError(409, "PROVIDER_UNAVAILABLE", "This provider is not accepting requests. Refresh and choose an available provider.");
			const booking = new DispatchService(void 0, {
				actors: [],
				bookings: await bookings(client, "b.motorist_id=$1 and b.status in ('searching','assigned')", [user.id])
			}).create(actor, {
				draft,
				vehicle: vehicleRow(vehicle),
				requestId: input.requestId
			});
			booking.providerName = provider.name;
			await client.query(`insert into public.bookings(id,motorist_id,provider_id,provider_name_snapshot,service,vehicle_snapshot,
        incident,notes,pickup,destination,base_centavos,travel_centavos,provider_centavos,platform_centavos,created_at,updated_at)
        values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [
				dbId(booking.id),
				user.id,
				booking.providerId,
				booking.providerName,
				booking.service,
				JSON.stringify(booking.vehicle),
				booking.incident,
				booking.notes,
				booking.pickup,
				booking.destination,
				Math.round(booking.quote.base * 100),
				Math.round(booking.quote.travel * 100),
				Math.round(booking.quote.provider * 100),
				Math.round(booking.quote.fee * 100),
				booking.createdAt,
				booking.updatedAt
			]);
			await addEvent(client, booking);
			await client.query("insert into app_private.booking_requests(motorist_id,request_id,booking_id,payload) values ($1,$2,$3,$4::jsonb)", [
				user.id,
				input.requestId,
				dbId(booking.id),
				JSON.stringify(payload)
			]);
			return booking;
		});
	}
	command(user, workspace, id, input) {
		return this.run(async (client) => {
			const actor = await actorFor(client, user, workspace);
			const target = dbId(id);
			await client.query("select id from public.bookings where id=$1 for update", [target]);
			const current = (await bookings(client, "b.id=$1", [target]))[0];
			if (!current) missing();
			const active = await bookings(client, "b.provider_id=$1 and b.status='assigned' and b.id<>$2", [current.providerId, target]);
			const booking = new DispatchService(void 0, {
				actors: await roster(client, actor),
				bookings: [current, ...active]
			}).command(actor, current.id, input);
			if (booking.operatorId) await client.query("select id from public.operators where id=$1 for update", [booking.operatorId]);
			await client.query(`update public.bookings set operator_id=$2,status=$3,stage=$4,version=$5,cancellation_reason=$6,updated_at=$7 where id=$1`, [
				target,
				booking.operatorId ?? null,
				booking.status,
				booking.stage,
				booking.version,
				booking.cancellationReason ?? null,
				booking.updatedAt
			]);
			for (const operatorId of booking.declinedOperatorIds.filter((value) => !current.declinedOperatorIds.includes(value))) await client.query("insert into public.booking_declines(booking_id,operator_id,provider_id) values ($1,$2,$3)", [
				target,
				operatorId,
				booking.providerId
			]);
			if (record(input) && input.action === "rate") await client.query(`insert into public.booking_ratings(booking_id,motorist_id,rating) values ($1,$2,$3)
        on conflict (booking_id) do update set rating=excluded.rating`, [
				target,
				user.id,
				booking.rating
			]);
			await addEvent(client, booking);
			return booking;
		});
	}
	saveProfile(user, input) {
		if (!record(input) || typeof input.name !== "string" || typeof input.phone !== "string") invalid("Enter your name and optional mobile number.");
		const profile = cleanProfile({
			name: input.name,
			phone: input.phone,
			email: user.email
		});
		const errors = validateProfile(profile);
		if (Object.keys(errors).length) invalid(Object.values(errors)[0]);
		return this.run(async (client) => {
			if (!(await client.query("update public.profiles set display_name=$2,phone=$3 where id=$1 returning id", [
				user.id,
				profile.name,
				profile.phone || null
			])).rows.length) missing();
			return profile;
		});
	}
	savePreference(user, input) {
		if (!record(input) || typeof input.enabled !== "boolean") invalid("Choose whether booking updates are enabled.");
		return this.run(async (client) => {
			const saved = await client.query("update public.profiles set booking_updates=$2 where id=$1 returning booking_updates", [user.id, input.enabled]);
			if (!saved.rows.length) missing();
			return { enabled: saved.rows[0].booking_updates };
		});
	}
	saveVehicle(user, input) {
		if (!isVehicle(input) || !uuid.test(input.id) || input.make.trim().length > 60 || input.model.trim().length > 60 || input.color.trim().length > 40 || Number(input.year) < 1950) invalid("Review the vehicle details: make/model up to 60 characters, color up to 40, and year from 1950.");
		const vehicle = input;
		return this.run(async (client) => {
			const saved = await client.query(`insert into public.vehicles(id,owner_id,make,model,year,type,color,plate) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set make=excluded.make, model=excluded.model, year=excluded.year, type=excluded.type,
        color=excluded.color, plate=excluded.plate where public.vehicles.owner_id=excluded.owner_id returning *`, [
				vehicle.id,
				user.id,
				vehicle.make.trim(),
				vehicle.model.trim(),
				Number(vehicle.year),
				vehicle.type,
				vehicle.color.trim(),
				vehicle.plate.trim().toUpperCase()
			]);
			if (!saved.rows.length) missing();
			return vehicleRow(saved.rows[0]);
		});
	}
	removeVehicle(user, id) {
		if (!uuid.test(id)) missing();
		return this.run(async (client) => {
			await client.query("delete from public.vehicles where id=$1 and owner_id=$2", [id, user.id]);
			return { removed: true };
		});
	}
};
//#endregion
//#region server/vercel/handler.ts
var pool = null;
var supabaseClient = null;
function getPool() {
	if (pool) return pool;
	const url = process.env.DATABASE_URL;
	if (!url) throw new ApiError(503, "DB_NOT_CONFIGURED", "Database connection not configured.");
	const uri = new URL(url);
	pool = new pg.Pool({
		host: uri.hostname,
		port: Number(uri.port) || 5432,
		database: uri.pathname.replace(/^\//, "") || "postgres",
		user: decodeURIComponent(uri.username),
		password: decodeURIComponent(uri.password),
		ssl: {
			rejectUnauthorized: true,
			...process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA } : {}
		},
		max: 2,
		connectionTimeoutMillis: 8e3,
		idleTimeoutMillis: 3e4,
		statement_timeout: 8e3,
		query_timeout: 1e4,
		application_name: "ligtastow-vercel"
	});
	pool.on("error", () => console.error("PostgreSQL idle connection lost"));
	return pool;
}
function getSupabase() {
	if (supabaseClient) return supabaseClient;
	const url = process.env.VITE_SUPABASE_URL;
	const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) throw new ApiError(503, "AUTH_NOT_CONFIGURED", "Supabase auth not configured.");
	supabaseClient = createClient(url, key, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false
		},
		global: { fetch: (u, init) => fetch(u, {
			...init,
			signal: AbortSignal.timeout(8e3)
		}) }
	});
	return supabaseClient;
}
function getTransaction() {
	const p = getPool();
	return async (work) => {
		for (let attempt = 0;; attempt++) {
			const client = await p.connect();
			let discard = false;
			try {
				await client.query("begin isolation level serializable");
				await client.query("set local role service_role");
				await client.query("set local lock_timeout = '5s'");
				const value = await work(client);
				await client.query("commit");
				return value;
			} catch (error) {
				try {
					await client.query("rollback");
				} catch {
					discard = true;
				}
				if (attempt < 2 && ["40001", "40P01"].includes(error.code ?? "")) continue;
				throw error;
			} finally {
				client.release(discard);
			}
		}
	};
}
var serviceInstance = null;
function getService() {
	if (!serviceInstance) serviceInstance = new PostgresDispatch(getTransaction());
	return serviceInstance;
}
async function verifyToken(token) {
	const { data, error } = await getSupabase().auth.getUser(token);
	if (error || !data.user) {
		if (error && (!error.status || error.status >= 500)) throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in verification is unavailable. Please retry shortly.");
		throw new ApiError(401, "SESSION_EXPIRED", "Your session is invalid or expired. Sign in again.");
	}
	if (!data.user.email_confirmed_at || data.user.is_anonymous) throw new ApiError(403, "EMAIL_CONFIRMATION_REQUIRED", "Confirm your email before using this account.");
	return {
		id: data.user.id,
		email: data.user.email ?? ""
	};
}
function isAllowedOrigin(origin) {
	if (!origin) return true;
	try {
		const host = new URL(origin).hostname;
		if (host === "localhost" || host === "127.0.0.1") return true;
		if (host.endsWith(".vercel.app")) return true;
		const allowed = process.env.ALLOWED_ORIGIN;
		if (allowed && new URL(allowed).hostname === host) return true;
		return false;
	} catch {
		return false;
	}
}
function parseBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let bytes = 0;
		req.on("data", (chunk) => {
			bytes += chunk.length;
			if (bytes > 16384) {
				reject(new ApiError(413, "BODY_TOO_LARGE", "Request body exceeds 16 KB."));
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch {
				reject(new ApiError(400, "INVALID_JSON", "Request body is not valid JSON."));
			}
		});
		req.on("error", reject);
	});
}
async function handler(req, res) {
	const origin = req.headers.origin;
	if (origin && isAllowedOrigin(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Workspace");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Max-Age", "86400");
	}
	if (req.method === "OPTIONS") {
		res.statusCode = 204;
		res.end();
		return;
	}
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");
	res.setHeader("X-Content-Type-Options", "nosniff");
	const send = (status, data) => {
		res.statusCode = status;
		res.end(JSON.stringify(data));
	};
	try {
		if (!isAllowedOrigin(origin)) throw new ApiError(403, "ORIGIN_REJECTED", "Cross-origin requests are not allowed.");
		const authorization = req.headers.authorization;
		if (!authorization || !/^Bearer [a-zA-Z0-9._-]+$/.test(authorization) || authorization.length > 16384) throw new ApiError(401, "SIGN_IN_REQUIRED", "Sign in to access your account.");
		const user = await verifyToken(authorization.slice(7));
		const service = getService();
		const workspace = typeof req.headers["x-workspace"] === "string" ? req.headers["x-workspace"] : "motorist";
		const path = (req.url ?? "").split("?")[0];
		if (req.method === "GET" && path === "/api/v2/session") return send(200, await service.session(user));
		if (req.method === "GET" && path === "/api/v2/snapshot") return send(200, await service.snapshot(user, workspace));
		if (req.method !== "POST") throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.");
		const body = await parseBody(req);
		if (path === "/api/v2/bookings") return send(201, await service.create(user, workspace, body));
		const command = path.match(/^\/api\/v2\/bookings\/([a-zA-Z0-9-]+)\/commands$/);
		if (command) return send(200, await service.command(user, workspace, command[1], body));
		if (path === "/api/v2/profile") return send(200, await service.saveProfile(user, body));
		if (path === "/api/v2/preferences") return send(200, await service.savePreference(user, body));
		if (path === "/api/v2/vehicles") return send(200, await service.saveVehicle(user, body));
		const deletion = path.match(/^\/api\/v2\/vehicles\/([a-zA-Z0-9-]+)\/delete$/);
		if (deletion) return send(200, await service.removeVehicle(user, deletion[1]));
		throw new ApiError(404, "NOT_FOUND", "Unknown account API endpoint.");
	} catch (error) {
		if (error instanceof ApiError) return send(error.status, { error: {
			code: error.code,
			message: error.message
		} });
		console.error("Account API request failed:", error.message ?? error);
		send(503, { error: {
			code: "SERVICE_UNAVAILABLE",
			message: "Account storage is unavailable. Retry shortly."
		} });
	}
}
//#endregion
export { handler as default };
