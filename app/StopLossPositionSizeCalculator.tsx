"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Info,
  ShieldAlert,
  TrendingDown,
  Calculator,
  BarChart3,
  LineChart,
  Target,
  Wallet,
} from "lucide-react";

type InstrumentType = "stock" | "option";
type OptionMode = "single" | "vertical";
type Side = "long" | "short";
type StopMode = "price" | "percent";
type MaxLossMethod = "defined" | "stop";
type RiskMode = "absolute" | "percent";

function fmt(n: unknown, digits = 2): string {
  const value = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}).format(n);
}

function clampFloorByStep(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return Math.floor(value);
  return Math.floor(value / step) * step;
}

function meterWidth(value: unknown, max: unknown): string {
  const v = typeof value === "number" ? value : Number(value);
  const m = typeof max === "number" ? max : Number(max);

  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return "0%";
  return `${Math.max(0, Math.min((v / m) * 100, 100))}%`;
}%`;
}

export default function StopLossPositionSizeCalculator() {
  const [instrumentType, setInstrumentType] = useState<InstrumentType>("stock");
  const [optionMode, setOptionMode] = useState<OptionMode>("single");
  const [side, setSide] = useState<Side>("long");
  const [entry, setEntry] = useState("100");
  const [stopMode, setStopMode] = useState<StopMode>("price");
  const [stopPrice, setStopPrice] = useState("95");
  const [stopPercent, setStopPercent] = useState("5");

  const [spreadWidth, setSpreadWidth] = useState("5");
  const [entryNetPremium, setEntryNetPremium] = useState("1.50");
  const [plannedExitNetPremium, setPlannedExitNetPremium] = useState("3.00");
  const [maxLossMethod, setMaxLossMethod] = useState<MaxLossMethod>("defined");

  const [riskMode, setRiskMode] = useState<RiskMode>("absolute");
  const [accountSize, setAccountSize] = useState("10000");
  const [maxLossAbs, setMaxLossAbs] = useState("100");
  const [maxLossPct, setMaxLossPct] = useState("1");

  const [contractMultiplier, setContractMultiplier] = useState("100");
  const [fees, setFees] = useState("0");
  const [slippagePerUnit, setSlippagePerUnit] = useState("0");
  const [lotStep, setLotStep] = useState("1");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isOption = instrumentType === "option";
  const isSpread = isOption && optionMode === "vertical";

  const values = useMemo(() => {
    const e = parseFloat(entry);
    const acct = parseFloat(accountSize);
    const absRisk = parseFloat(maxLossAbs);
    const pctRisk = parseFloat(maxLossPct);
    const feeValue = parseFloat(fees) || 0;
    const slippage = parseFloat(slippagePerUnit) || 0;
    const step = parseFloat(lotStep) || 1;
    const multiplier = isOption ? parseFloat(contractMultiplier) || 100 : 1;

    const width = parseFloat(spreadWidth);
    const netEntry = parseFloat(entryNetPremium);
    const plannedExit = parseFloat(plannedExitNetPremium);

    let stop = Number.NaN;
    let priceRiskPerUnit = Number.NaN;
    let totalRiskPerPositionUnit = Number.NaN;
    let positionValue = Number.NaN;
    let stopDistancePct = Number.NaN;
    let rewardToRisk1R: number | null = null;
    let rewardToRisk2R: number | null = null;
    let definedMaxLossPerContract: number | null = null;
    let maxProfitPerContract: number | null = null;

    if (isSpread) {
      stop = plannedExit;
      const spreadWidthValue = Number.isFinite(width) ? width : Number.NaN;
      const entryPremium = Number.isFinite(netEntry) ? netEntry : Number.NaN;
      const exitPremium = Number.isFinite(plannedExit) ? plannedExit : Number.NaN;

      const isCreditSpread = side === "short";
      const definedRiskPremium = isCreditSpread
        ? Math.max(spreadWidthValue - entryPremium, 0)
        : Math.max(entryPremium, 0);

      const stopBasedPremiumRisk = Math.abs(exitPremium - entryPremium) + slippage;
      const chosenPremiumRisk = maxLossMethod === "defined" ? definedRiskPremium : stopBasedPremiumRisk;

      priceRiskPerUnit = chosenPremiumRisk;
      totalRiskPerPositionUnit = chosenPremiumRisk * multiplier;
      positionValue = Math.abs(entryPremium) * multiplier;
      stopDistancePct = entryPremium > 0 ? (Math.abs(exitPremium - entryPremium) / entryPremium) * 100 : 0;
      definedMaxLossPerContract = definedRiskPremium * multiplier;

      if (isCreditSpread) {
        maxProfitPerContract = Math.max(entryPremium, 0) * multiplier;
      } else {
        maxProfitPerContract = Number.isFinite(spreadWidthValue) && Number.isFinite(entryPremium)
          ? Math.max(spreadWidthValue - entryPremium, 0) * multiplier
          : null;
      }

      if (Number.isFinite(entryPremium) && chosenPremiumRisk > 0) {
        rewardToRisk1R =
          side === "long"
            ? entryPremium + chosenPremiumRisk
            : Math.max(entryPremium - chosenPremiumRisk, 0);
        rewardToRisk2R =
          side === "long"
            ? entryPremium + chosenPremiumRisk * 2
            : Math.max(entryPremium - chosenPremiumRisk * 2, 0);
      }
    } else {
      if (stopMode === "price") {
        stop = parseFloat(stopPrice);
      } else {
        const pct = (parseFloat(stopPercent) || 0) / 100;
        stop = side === "long" ? e * (1 - pct) : e * (1 + pct);
      }

      priceRiskPerUnit = Math.abs(e - stop);
      const perShareOrPremiumRisk = priceRiskPerUnit + slippage;
      totalRiskPerPositionUnit = perShareOrPremiumRisk * multiplier;
      positionValue = e * multiplier;
      stopDistancePct = e > 0 ? (priceRiskPerUnit / e) * 100 : 0;
      rewardToRisk1R =
        priceRiskPerUnit > 0 ? e + (side === "long" ? priceRiskPerUnit : -priceRiskPerUnit) : null;
      rewardToRisk2R =
        priceRiskPerUnit > 0 ? e + (side === "long" ? priceRiskPerUnit * 2 : -priceRiskPerUnit * 2) : null;
    }

    const riskBudget = riskMode === "absolute" ? absRisk : acct * ((pctRisk || 0) / 100);
    const rawSize =
      totalRiskPerPositionUnit > 0 ? Math.max((riskBudget - feeValue) / totalRiskPerPositionUnit, 0) : 0;
    const roundedSize = clampFloorByStep(rawSize, step);
    const underlyingUnitsControlled = roundedSize * multiplier;
    const totalPositionCost = roundedSize * positionValue;
    const estimatedLoss = roundedSize * totalRiskPerPositionUnit + feeValue;
    const effectiveRiskPct = acct > 0 ? (estimatedLoss / acct) * 100 : null;
    const capitalUsagePct = acct > 0 ? (totalPositionCost / acct) * 100 : null;

    const issues: string[] = [];
    if (!(riskBudget > 0)) issues.push("Max loss must be greater than 0.");
    if (riskMode === "percent" && !(acct > 0)) issues.push("Account size must be greater than 0 when using % risk.");
    if (isOption && !(multiplier > 0)) issues.push("Contract multiplier must be greater than 0.");

    if (isSpread) {
      if (!(width > 0)) issues.push("Spread width must be greater than 0.");
      if (!(netEntry > 0)) issues.push("Net entry premium must be greater than 0.");
      if (!(plannedExit >= 0)) issues.push("Planned exit premium must be 0 or greater.");
      if (side === "short" && Number.isFinite(width) && Number.isFinite(netEntry) && netEntry >= width) {
        issues.push("For a short credit spread, net credit should usually be smaller than spread width.");
      }
      if (!(priceRiskPerUnit > 0)) issues.push("Calculated risk per contract must be greater than 0.");
    } else {
      if (!(e > 0)) issues.push(isOption ? "Entry premium must be greater than 0." : "Entry price must be greater than 0.");
      if (!(stop >= 0)) issues.push(isOption ? "Stop premium must be 0 or greater." : "Stop price must be 0 or greater.");
      if (side === "long" && Number.isFinite(e) && Number.isFinite(stop) && stop >= e) {
        issues.push(`For a long ${isOption ? "option premium trade" : "trade"}, stop should be below entry.`);
      }
      if (side === "short" && Number.isFinite(e) && Number.isFinite(stop) && stop <= e) {
        issues.push(`For a short ${isOption ? "option premium trade" : "trade"}, stop should be above entry.`);
      }
      if (!(priceRiskPerUnit > 0)) issues.push("Stop distance must be greater than 0.");
    }

    if (roundedSize <= 0 && issues.length === 0) {
      issues.push(
        `Size rounds down to 0. Your risk budget is too small for this ${isSpread ? "spread risk" : "stop distance"}, ${isOption ? "contract multiplier, " : ""}and lot size.`,
      );
    }

    return {
      entry: e,
      stop,
      acct,
      multiplier,
      netEntry,
      plannedExit,
      riskBudget,
      totalRiskPerPositionUnit,
      roundedSize,
      underlyingUnitsControlled,
      totalPositionCost,
      estimatedLoss,
      stopDistancePct,
      rewardToRisk1R,
      rewardToRisk2R,
      definedMaxLossPerContract,
      maxProfitPerContract,
      effectiveRiskPct,
      capitalUsagePct,
      issues,
    };
  }, [
    accountSize,
    contractMultiplier,
    entry,
    entryNetPremium,
    fees,
    instrumentType,
    isOption,
    isSpread,
    lotStep,
    maxLossAbs,
    maxLossMethod,
    maxLossPct,
    optionMode,
    plannedExitNetPremium,
    riskMode,
    side,
    slippagePerUnit,
    spreadWidth,
    stopMode,
    stopPercent,
    stopPrice,
  ]);

  const reset = () => {
    setInstrumentType("stock");
    setOptionMode("single");
    setSide("long");
    setEntry("100");
    setStopMode("price");
    setStopPrice("95");
    setStopPercent("5");
    setSpreadWidth("5");
    setEntryNetPremium("1.50");
    setPlannedExitNetPremium("3.00");
    setMaxLossMethod("defined");
    setRiskMode("absolute");
    setAccountSize("10000");
    setMaxLossAbs("100");
    setMaxLossPct("1");
    setContractMultiplier("100");
    setFees("0");
    setSlippagePerUnit("0");
    setLotStep("1");
    setShowAdvanced(false);
  };

  const sizeUnitLabel = isOption ? "contracts" : "shares";
  const entryLabel = isOption ? "Entry Premium" : "Entry Price";
  const stopLabel = isOption ? "Stop Premium" : "Stop Price";
  const stopModePercentLabel = isOption ? "Premium Stop %" : "Stop %";
  const stopDistanceLabel = isOption ? "Premium Move" : "Price Move";
  const positionValueLabel = isSpread
    ? "Position Cost / Credit"
    : isOption
      ? "Premium Cost"
      : "Position Value";
  const riskPerUnitLabel = isSpread ? "Risk / Spread" : isOption ? "Risk / Contract" : "Risk / Share";
  const stopOrExitValue = isSpread && maxLossMethod === "stop" ? values.plannedExit : isSpread ? values.netEntry : values.stop;
  const stopOrExitSubLabel = isSpread
    ? maxLossMethod === "stop"
      ? "Planned exit premium"
      : "Entry net premium"
    : stopLabel;

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <div className="border-b border-slate-800 bg-[#131a2a]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-400">
              <LineChart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Risk &amp; Position Size Calculator</h1>
              <p className="text-xs text-slate-400">
                TradingView-style layout for stocks, single options, and vertical spreads
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border-slate-700 bg-slate-800 text-slate-300">
              {isOption ? "Options" : "Stocks"}
            </Badge>
            <Badge variant="secondary" className="border-slate-700 bg-slate-800 text-slate-300">
              {side === "long" ? "Long" : "Short"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-12 md:p-6" style={{ isolation: "isolate" }}>
        <Card className="relative z-10 border-slate-800 bg-[#131a2a] text-slate-100 shadow-none md:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-sky-400" /> Inputs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300">Instrument</Label>
              <Tabs value={instrumentType} onValueChange={(value) => setInstrumentType(value as InstrumentType)}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                  <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="stock">
                    Stocks
                  </TabsTrigger>
                  <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="option">
                    Options
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {isOption && (
              <div className="space-y-2">
                <Label className="text-slate-300">Structure</Label>
                <Tabs value={optionMode} onValueChange={(value) => setOptionMode(value as OptionMode)}>
                  <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                    <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="single">
                      Single
                    </TabsTrigger>
                    <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="vertical">
                      Vertical
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300">Direction</Label>
              <Tabs value={side} onValueChange={(value) => setSide(value as Side)}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                  <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="long">
                    Long
                  </TabsTrigger>
                  <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="short">
                    Short
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {!isSpread ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="entry" className="text-slate-300">
                    {entryLabel}
                  </Label>
                  <Input
                    id="entry"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Stop Type</Label>
                  <Tabs value={stopMode} onValueChange={(value) => setStopMode(value as StopMode)}>
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                      <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="price">
                        {stopLabel}
                      </TabsTrigger>
                      <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="percent">
                        {stopModePercentLabel}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {stopMode === "price" ? (
                  <div className="space-y-2">
                    <Label htmlFor="stopPrice" className="text-slate-300">
                      {stopLabel}
                    </Label>
                    <Input
                      id="stopPrice"
                      className="border-slate-700 bg-slate-900 text-slate-100"
                      inputMode="decimal"
                      value={stopPrice}
                      onChange={(e) => setStopPrice(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="stopPercent" className="text-slate-300">
                      {isOption ? "Premium Stop Distance (%)" : "Stop Distance (%)"}
                    </Label>
                    <Input
                      id="stopPercent"
                      className="border-slate-700 bg-slate-900 text-slate-100"
                      inputMode="decimal"
                      value={stopPercent}
                      onChange={(e) => setStopPercent(e.target.value)}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="spreadWidth" className="text-slate-300">
                    Spread Width
                  </Label>
                  <Input
                    id="spreadWidth"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={spreadWidth}
                    onChange={(e) => setSpreadWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entryNetPremium" className="text-slate-300">
                    {side === "short" ? "Net Credit Received" : "Net Debit Paid"}
                  </Label>
                  <Input
                    id="entryNetPremium"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={entryNetPremium}
                    onChange={(e) => setEntryNetPremium(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Spread Risk Method</Label>
                  <Tabs value={maxLossMethod} onValueChange={(value) => setMaxLossMethod(value as MaxLossMethod)}>
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                      <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="defined">
                        Defined
                      </TabsTrigger>
                      <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="stop">
                        Exit Premium
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                {maxLossMethod === "stop" && (
                  <div className="space-y-2">
                    <Label htmlFor="plannedExitNetPremium" className="text-slate-300">
                      Planned Exit Premium
                    </Label>
                    <Input
                      id="plannedExitNetPremium"
                      className="border-slate-700 bg-slate-900 text-slate-100"
                      inputMode="decimal"
                      value={plannedExitNetPremium}
                      onChange={(e) => setPlannedExitNetPremium(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label className="text-slate-300">Risk Budget</Label>
              <Tabs value={riskMode} onValueChange={(value) => setRiskMode(value as RiskMode)}>
                <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                  <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="absolute">
                    $
                  </TabsTrigger>
                  <TabsTrigger className="text-slate-300 data-[state=active]:bg-white data-[state=active]:text-slate-950" value="percent">
                    % Acct
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {riskMode === "absolute" ? (
              <div className="space-y-2">
                <Label htmlFor="maxLossAbs" className="text-slate-300">
                  Max Loss ($)
                </Label>
                <Input
                  id="maxLossAbs"
                  className="border-slate-700 bg-slate-900 text-slate-100"
                  inputMode="decimal"
                  value={maxLossAbs}
                  onChange={(e) => setMaxLossAbs(e.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="accountSize" className="text-slate-300">
                    Account Size ($)
                  </Label>
                  <Input
                    id="accountSize"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={accountSize}
                    onChange={(e) => setAccountSize(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLossPct" className="text-slate-300">
                    Risk %
                  </Label>
                  <Input
                    id="maxLossPct"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={maxLossPct}
                    onChange={(e) => setMaxLossPct(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-slate-300">Advanced</Label>
                  <p className="text-xs text-slate-500">Multiplier, fees, slippage, rounding</p>
                </div>
                <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
              </div>
            </div>

            {showAdvanced && (
              <div className="grid gap-3">
                {isOption && (
                  <div className="space-y-2">
                    <Label htmlFor="contractMultiplier" className="text-slate-300">
                      Contract Multiplier
                    </Label>
                    <Input
                      id="contractMultiplier"
                      className="border-slate-700 bg-slate-900 text-slate-100"
                      inputMode="decimal"
                      value={contractMultiplier}
                      onChange={(e) => setContractMultiplier(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="fees" className="text-slate-300">
                    Fees ($)
                  </Label>
                  <Input
                    id="fees"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slippage" className="text-slate-300">
                    Slippage
                  </Label>
                  <Input
                    id="slippage"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={slippagePerUnit}
                    onChange={(e) => setSlippagePerUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lotStep" className="text-slate-300">
                    Step Size
                  </Label>
                  <Input
                    id="lotStep"
                    className="border-slate-700 bg-slate-900 text-slate-100"
                    inputMode="decimal"
                    value={lotStep}
                    onChange={(e) => setLotStep(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={reset}
              variant="outline"
              className="w-full border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Reset
            </Button>
          </CardContent>
        </Card>

        <div className="relative z-0 space-y-4 md:col-span-5">
          <Card className="border-slate-800 bg-[#131a2a] text-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-sky-400" /> Position Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Suggested Size</p>
                  <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-tight xl:text-xl">
                    {fmt(values.roundedSize, 4)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{sizeUnitLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Risk Budget</p>
                  <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-tight xl:text-xl">
                    ${fmt(values.riskBudget)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Allowed loss</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Estimated Loss</p>
                  <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-tight xl:text-xl">
                    ${fmt(values.estimatedLoss)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">At stop</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{positionValueLabel}</p>
                  <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-tight xl:text-xl">
                    ${fmt(values.totalPositionCost)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Capital used</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Trade ruler</p>
                    <p className="text-xs text-slate-500">
                      A TradingView-inspired visual so your eyeballs can help your math.
                    </p>
                  </div>
                  <Badge className="bg-slate-800 text-slate-300">
                    {isSpread ? "Spread" : isOption ? "Option" : "Stock"}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Risk used</span>
                      <span>
                        {values.effectiveRiskPct == null ? "—" : `${fmt(values.effectiveRiskPct)}% of account`}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: meterWidth(values.estimatedLoss, values.riskBudget || values.estimatedLoss) }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Capital usage</span>
                      <span>
                        {values.capitalUsagePct == null ? "—" : `${fmt(values.capitalUsagePct)}% of account`}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: meterWidth(values.totalPositionCost, values.acct || values.totalPositionCost) }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Stop / Exit</p>
                    <p className="mt-2 whitespace-nowrap text-xl font-semibold">${fmt(stopOrExitValue)}</p>
                    <p className="mt-1 text-xs text-slate-400">{stopOrExitSubLabel}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{riskPerUnitLabel}</p>
                    <p className="mt-2 whitespace-nowrap text-xl font-semibold">
                      ${fmt(values.totalRiskPerPositionUnit)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Per sizing unit</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{stopDistanceLabel}</p>
                    <p className="mt-2 whitespace-nowrap text-xl font-semibold">{fmt(values.stopDistancePct)}%</p>
                    <p className="mt-1 text-xs text-slate-400">Distance to stop</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-300">
                    <Target className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium">Planning targets</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">1R</p>
                      <p className="mt-1 whitespace-nowrap text-xl font-semibold">
                        {values.rewardToRisk1R == null ? "—" : `$${fmt(values.rewardToRisk1R)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">2R</p>
                      <p className="mt-1 whitespace-nowrap text-xl font-semibold">
                        {values.rewardToRisk2R == null ? "—" : `$${fmt(values.rewardToRisk2R)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-300">
                    <Wallet className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-medium">Exposure</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Controlled Units</p>
                      <p className="mt-1 whitespace-nowrap text-xl font-semibold">
                        {fmt(values.underlyingUnitsControlled, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Multiplier</p>
                      <p className="mt-1 whitespace-nowrap text-xl font-semibold">{fmt(values.multiplier, 0)}x</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative z-0 space-y-4 md:col-span-3">
          <Card className="border-slate-800 bg-[#131a2a] text-slate-100 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Defined Max Loss / Spread</p>
                <p className="mt-2 whitespace-nowrap text-xl font-semibold">
                  {values.definedMaxLossPerContract == null ? "—" : `$${fmt(values.definedMaxLossPerContract)}`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Max Profit / Spread</p>
                <p className="mt-2 whitespace-nowrap text-xl font-semibold">
                  {values.maxProfitPerContract == null ? "—" : `$${fmt(values.maxProfitPerContract)}`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Formula</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {!isOption
                    ? "Position Size = (Max Loss Budget − Fees) ÷ (|Entry − Stop| + Slippage per Unit)"
                    : !isSpread
                      ? "Contracts = (Max Loss Budget − Fees) ÷ ((|Entry Premium − Stop Premium| + Slippage) × Contract Multiplier)"
                      : maxLossMethod === "defined"
                        ? "Spreads = (Max Loss Budget − Fees) ÷ (Defined Max Loss per Spread)"
                        : "Spreads = (Max Loss Budget − Fees) ÷ ((|Entry Net Premium − Planned Exit Premium| + Slippage) × Contract Multiplier)"}
                </p>
              </div>
            </CardContent>
          </Card>

          {values.issues.length > 0 ? (
            <Alert className="border-amber-900 bg-amber-950/40 text-amber-100">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Check your inputs</AlertTitle>
              <AlertDescription>
                <ul className="ml-5 list-disc space-y-1 text-sm text-amber-100/90">
                  {values.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-900 bg-emerald-950/30 text-emerald-100">
              <TrendingDown className="h-4 w-4" />
              <AlertTitle>Plan checks out</AlertTitle>
              <AlertDescription className="text-sm text-emerald-100/90">
                Your risk, size, and stop are aligned. Miracles do happen.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-slate-800 bg-[#131a2a] text-slate-100">
            <Info className="h-4 w-4 text-sky-400" />
            <AlertTitle>Best practice</AlertTitle>
            <AlertDescription className="text-sm text-slate-300">
              Size from the stop, not from your feelings. Use defined-risk sizing for spreads, include slippage for fast markets, and round down instead of volunteering for pain.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
