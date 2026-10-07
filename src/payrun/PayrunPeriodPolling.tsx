import { useEffect, useMemo } from "react";
import { useFetcher, useMatches, useRouteLoaderData } from "react-router-dom";
import { PayrunPeriod, PayrunPeriodEntry } from "../models/PayrunPeriod";
import { PayrunPeriodLoaderData } from "./PayrunPeriodLoaderData";

const pollingFetcherKey = "payrunperiod-polling";

type PollingData = {
	payrunPeriod: PayrunPeriod | null;
};

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
 * The "payrunperiod" route loader data with the most recently polled payrun period.
 */
export function usePayrunPeriodLoaderData(): PayrunPeriodLoaderData {
	const loaderData = useRouteLoaderData(
		"payrunperiod",
	) as PayrunPeriodLoaderData;
	const fetcher = useFetcher<PollingData>({ key: pollingFetcherKey });
	const polledPayrunPeriod = fetcher.data?.payrunPeriod;
	return useMemo(() => {
		if (polledPayrunPeriod?.id !== loaderData.payrunPeriod.id) {
			return loaderData;
		}
		return { ...loaderData, payrunPeriod: polledPayrunPeriod };
	}, [loaderData, polledPayrunPeriod]);
}

/**
 * Reloads the payrun period while entries are being calculated, the more
 * entries are calculated, the less frequent.
 */
export function usePayrunPeriodPolling(payrunPeriod: PayrunPeriod) {
	const fetcher = useFetcher<PollingData>({ key: pollingFetcherKey });
	const payrunPeriodPath = useMatches().find(
		(match) => match.id === "payrunperiod",
	)?.pathname;
	const isOpen = payrunPeriod.periodStatus === "Open";
	const interval = isOpen
		? getPollingInterval(payrunPeriod.entries.filter(isBeingCalculated).length)
		: null;

	useEffect(() => {
		if (interval === null || fetcher.state !== "idle") return;
		const timeout = setTimeout(
			() => fetcher.load(`${payrunPeriodPath}?periodOnly`),
			interval,
		);
		return () => clearTimeout(timeout);
		// fetcher.state is a dependency so that every completed poll schedules the next one
	}, [interval, fetcher.state, payrunPeriodPath]);
}
