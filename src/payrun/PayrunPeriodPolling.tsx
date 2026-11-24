import { createContext, useContext, useEffect, useMemo } from "react";
import { Outlet, useLoaderData, useRevalidator } from "react-router-dom";
import { PayrunPeriod, PayrunPeriodEntry } from "../models/PayrunPeriod";
import { PayrunPeriodLoaderData } from "./PayrunPeriodLoaderData";

type PayrunPeriodRouteData = Omit<PayrunPeriodLoaderData, "payrunPeriod">;

const PayrunPeriodRouteDataContext = createContext<PayrunPeriodRouteData>(
	null!,
);
const PayrunPeriodContext = createContext<PayrunPeriod>(null!);

function isBeingCalculated(entry: PayrunPeriodEntry) {
	return entry.state === "OutOfDate" || entry.state === "Generating";
}

function getPollingInterval(calculatingCount: number): number | null {
	if (calculatingCount === 0) return null;
	if (calculatingCount < 5) return 2000;
	if (calculatingCount <= 15) return 5000;
	return 10000;
}

/**
 * Provides the data of the payrun period route, which is only reloaded on navigation.
 */
export function PayrunPeriodRoute() {
	const routeData = useLoaderData() as PayrunPeriodRouteData;
	return (
		<PayrunPeriodRouteDataContext.Provider value={routeData}>
			<Outlet />
		</PayrunPeriodRouteDataContext.Provider>
	);
}

/**
 * Provides the payrun period and keeps it up to date while entries are being calculated.
 */
export function PayrunPeriodLiveRoute() {
	const { payrunPeriod } = useLoaderData() as { payrunPeriod: PayrunPeriod };
	usePayrunPeriodPolling(payrunPeriod);
	return (
		<PayrunPeriodContext.Provider value={payrunPeriod}>
			<Outlet />
		</PayrunPeriodContext.Provider>
	);
}

export function usePayrunPeriodLoaderData(): PayrunPeriodLoaderData {
	const routeData = useContext(PayrunPeriodRouteDataContext);
	const payrunPeriod = useContext(PayrunPeriodContext);
	return useMemo(
		() => ({ ...routeData, payrunPeriod }),
		[routeData, payrunPeriod],
	);
}

/**
 * Revalidates while entries are being calculated, the more entries are
 * calculated, the less frequent. The routes decide in `shouldRevalidate`
 * what gets reloaded.
 */
function usePayrunPeriodPolling(payrunPeriod: PayrunPeriod) {
	const { revalidate, state } = useRevalidator();
	const isOpen = payrunPeriod.periodStatus === "Open";
	const interval = isOpen
		? getPollingInterval(payrunPeriod.entries.filter(isBeingCalculated).length)
		: null;

	useEffect(() => {
		if (interval === null || state !== "idle") return;
		const timeout = setTimeout(revalidate, interval);
		return () => clearTimeout(timeout);
		// state is a dependency so that every completed poll schedules the next one
	}, [interval, state, revalidate]);
}
