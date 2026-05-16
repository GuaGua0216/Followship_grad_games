"use client";

import { useState } from "react";

const INITIAL_BALANCE = 30;

const stages = ["大一", "大二", "大三", "大四"] as const;

const products = [
  { name: "顏值", prices: [3, 5, 3, 1] },
  { name: "人際", prices: [4, 5, 3, 2] },
  { name: "信仰", prices: [3, 2, 3, 5] },
  { name: "錢$$", prices: [2, 2, 3, 4] },
  { name: "技能", prices: [2, 3, 4, 5] }
] as const;

const glassButton =
  "rounded-md border border-white/70 bg-white/15 px-5 py-3 font-bold text-white shadow-lg shadow-black/20 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/25 hover:shadow-xl disabled:cursor-not-allowed disabled:border-white/25 disabled:bg-white/10 disabled:text-white/45 disabled:shadow-none disabled:hover:translate-y-0";
const glassPanel =
  "rounded-lg border border-white/35 bg-white/35 shadow-xl shadow-black/20 backdrop-blur-xl";
const beachCard =
  "rounded-lg border border-white/30 bg-white/30 shadow-md shadow-black/15 backdrop-blur-lg";

type ProductName = (typeof products)[number]["name"];
type Stage = (typeof stages)[number];
type Screen = "start" | "stage" | "shop" | "result";
type ProductNumbers = Record<ProductName, number>;

type Trade = {
  buy: ProductNumbers;
  sell: ProductNumbers;
};

type RoundResult = ReturnType<typeof calculateRound>;

const initialProductNumbers = products.reduce((acc, product) => {
  acc[product.name] = 0;
  return acc;
}, {} as ProductNumbers);

function calculateRound(
  stageIndex: number,
  trade: Trade,
  balanceBefore: number,
  inventoryBefore: ProductNumbers,
) {
  const items = products.map((product) => {
    const price = product.prices[stageIndex];
    const buyQuantity = trade.buy[product.name];
    const sellQuantity = trade.sell[product.name];
    const buyCost = price * buyQuantity;
    const sellRevenue = price * sellQuantity;

    return {
      name: product.name,
      price,
      buyQuantity,
      sellQuantity,
      buyCost,
      sellRevenue,
      inventoryAfter:
        inventoryBefore[product.name] + buyQuantity - sellQuantity,
    };
  });

  const totalBuyCost = items.reduce((sum, item) => sum + item.buyCost, 0);
  const totalSellRevenue = items.reduce(
    (sum, item) => sum + item.sellRevenue,
    0,
  );

  return {
    items,
    totalBuyCost,
    totalSellRevenue,
    balanceBefore,
    balanceAfter: balanceBefore - totalBuyCost + totalSellRevenue,
  };
}

function makeEmptyTrade(): Trade {
  return {
    buy: { ...initialProductNumbers },
    sell: { ...initialProductNumbers },
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("start");
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [inventory, setInventory] = useState<ProductNumbers>({
    ...initialProductNumbers,
  });
  const [completedStages, setCompletedStages] = useState<boolean[]>(
    stages.map(() => false),
  );
  const [selectedStage, setSelectedStage] = useState<Stage>("大一");
  const [trade, setTrade] = useState<Trade>(makeEmptyTrade);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);

  const selectedStageIndex = stages.indexOf(selectedStage);
  const nextStageIndex = completedStages.findIndex((completed) => !completed);
  const activeStageIndex =
    nextStageIndex === -1 ? stages.length - 1 : nextStageIndex;

  const hasInvalidSell = products.some(
    (product) => trade.sell[product.name] > inventory[product.name],
  );
  const canConfirmTrade = !hasInvalidSell;
  const allStagesDone = completedStages.every(Boolean);

  function startGame() {
    setBalance(INITIAL_BALANCE);
    setInventory({ ...initialProductNumbers });
    setCompletedStages(stages.map(() => false));
    setSelectedStage("大一");
    setTrade(makeEmptyTrade());
    setRoundResult(null);
    setScreen("stage");
  }

  function chooseStage(stage: Stage) {
    setSelectedStage(stage);
    setTrade(makeEmptyTrade());
    setRoundResult(null);
    setScreen("shop");
  }

  function updateTrade(
    action: keyof Trade,
    productName: ProductName,
    value: string,
  ) {
    const parsedValue = Number.parseInt(value || "0", 10);
    const nextValue = Number.isNaN(parsedValue) ? 0 : Math.max(0, parsedValue);

    setTrade((current) => ({
      ...current,
      [action]: {
        ...current[action],
        [productName]: nextValue,
      },
    }));
  }

  function confirmTrade() {
    if (!canConfirmTrade) {
      return;
    }

    const result = calculateRound(
      selectedStageIndex,
      trade,
      balance,
      inventory,
    );

    const nextInventory = { ...inventory };
    result.items.forEach((item) => {
      nextInventory[item.name] = item.inventoryAfter;
    });

    setBalance(result.balanceAfter);
    setInventory(nextInventory);
    setCompletedStages((current) =>
      current.map((completed, index) =>
        index === selectedStageIndex ? true : completed,
      ),
    );
    setRoundResult(result);
    setScreen("result");
  }

  function backToStages() {
    setTrade(makeEmptyTrade());
    setRoundResult(null);
    setScreen("stage");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(90deg,rgba(2,38,45,0.58),rgba(2,72,82,0.34),rgba(255,245,219,0.18)),url('/beach.jpg')] bg-cover bg-center bg-fixed px-5 py-8 text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80 drop-shadow">
              Graduation Market
            </p>
            <h1 className="mt-2 text-3xl font-black text-white drop-shadow-lg sm:text-5xl">
              畢業採購遊戲
            </h1>
          </div>
          {screen !== "start" ? (
            <button className={glassButton} onClick={backToStages} type="button">
              返回選擇年級
            </button>
          ) : null}
        </header>

        <section className="flex flex-1 items-center py-10">
          {screen === "start" ? (
            <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="max-w-2xl text-lg font-semibold leading-8 text-white drop-shadow">
                  每位玩家一開始都有 30 元。每個年級都有不同商品價格，
                  玩家可以買入或賣出商品，但價格要等本回合結束才公布。
                </p>
                <button
                  className={`${glassButton} mt-8 px-7 py-4 text-lg`}
                  onClick={startGame}
                  type="button"
                >
                  開始遊戲
                </button>
              </div>
              <div className={`${glassPanel} p-6`}>
                <p className="text-sm font-semibold text-[#31717a]">
                  初始餘額
                </p>
                <p className="mt-3 text-6xl font-black text-[#057486]">
                  {INITIAL_BALANCE} 元
                </p>
                <div className="mt-8 grid grid-cols-4 gap-2">
                  {stages.map((stage) => (
                    <span
                      className="rounded-md bg-[#fff4d8]/70 px-3 py-2 text-center text-sm font-bold text-[#0d6570]"
                      key={stage}
                    >
                      {stage}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {screen === "stage" ? (
            <div className="w-full">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white/85 drop-shadow">
                    選擇年級
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-white drop-shadow-lg">
                    依序完成大一到大四
                  </h2>
                </div>
                <div className={`${glassPanel} px-5 py-4 text-[#06434b]`}>
                  <p className="text-sm font-semibold text-[#31717a]">
                    目前餘額
                  </p>
                  <p className="mt-1 text-3xl font-black text-[#057486]">
                    {balance} 元
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stages.map((stage, index) => {
                  const isCompleted = completedStages[index];
                  const isLocked = index !== activeStageIndex || allStagesDone;

                  return (
                    <button
                      className={[
                        "rounded-lg border p-6 text-left shadow-sm backdrop-blur-sm transition",
                        isCompleted
                          ? "cursor-not-allowed border-white/45 bg-white/45 text-[#2d6871]"
                          : "",
                        !isCompleted && isLocked
                          ? "cursor-not-allowed border-white/40 bg-white/35 text-[#3a727b] opacity-85"
                          : "",
                        !isCompleted && !isLocked
                          ? "border-white/70 bg-white/45 text-[#06434b] hover:-translate-y-1 hover:border-white hover:bg-white/65 hover:shadow-lg hover:shadow-[#83d2e4]/20"
                          : "",
                      ].join(" ")}
                      disabled={isCompleted || isLocked}
                      key={stage}
                      onClick={() => chooseStage(stage)}
                      type="button"
                    >
                      <span className="text-sm font-semibold">
                        階段 {index + 1}
                      </span>
                      <span className="mt-4 block text-4xl font-black">
                        {stage}
                      </span>
                      <span className="mt-4 block text-sm font-semibold">
                        {isCompleted
                          ? "已完成"
                          : index === activeStageIndex && !allStagesDone
                            ? "可選擇"
                            : "尚未開放"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {allStagesDone ? (
                <div className="mt-8 rounded-lg bg-[#0f7480]/80 p-6 text-white shadow-lg shadow-[#83d2e4]/25 backdrop-blur-md">
                  <p className="text-lg font-bold">四個階段都完成了</p>
                  <p className="mt-2 text-4xl font-black">最終餘額 {balance} 元</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {screen === "shop" ? (
            <div className="w-full">
              <p className="text-sm font-semibold text-white/85 drop-shadow">
                {selectedStage} 交易
              </p>
              <h2 className="mt-2 text-3xl font-black text-white drop-shadow-lg">
                選擇這一回合要買入或賣出的數量
              </h2>
              <p className="mt-3 font-semibold text-white drop-shadow">
                {selectedStageIndex === 0
                  ? "本頁不顯示商品價格；賣出數量不能超過已持有數量。"
                  : `本頁會顯示${selectedStage}的商品價格；賣出數量不能超過已持有數量。`}
              </p>

              <div className="mt-8 grid gap-4">
                {products.map((product) => {
                  const sellTooMany =
                    trade.sell[product.name] > inventory[product.name];
                  const stagePrice = product.prices[selectedStageIndex];

                  return (
                    <div className={`${beachCard} p-5`} key={product.name}>
                      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_12rem] sm:items-end">
                        <div>
                          <p className="text-xl font-black text-[#063c43]">
                            {product.name}
                          </p>
                          {selectedStageIndex === 0 ? null : (
                            <p className="mt-1 text-sm font-semibold text-[#0f7480]">
                              {selectedStage} 價格 {stagePrice} 元
                            </p>
                          )}
                          <p className="mt-1 text-sm font-semibold text-[#31717a]">
                            目前持有 {inventory[product.name]} 個
                          </p>
                        </div>
                        <label>
                          <span className="mb-2 block text-sm font-bold text-[#115b63]">
                            買入數量
                          </span>
                          <input
                            className="h-12 w-full rounded-md border border-white/70 bg-white/55 px-4 text-lg font-bold text-[#06434b] outline-none transition focus:border-[#83d2e4] focus:ring-4 focus:ring-[#83d2e4]/25"
                            min="0"
                            onChange={(event) =>
                              updateTrade(
                                "buy",
                                product.name,
                                event.target.value,
                              )
                            }
                            type="number"
                            value={trade.buy[product.name]}
                          />
                        </label>
                        <label>
                          <span className="mb-2 block text-sm font-bold text-[#115b63]">
                            賣出數量
                          </span>
                          <input
                            className={[
                              "h-12 w-full rounded-md border bg-white/55 px-4 text-lg font-bold text-[#06434b] outline-none transition focus:ring-4",
                              sellTooMany
                                ? "border-[#168da0] bg-[#dff7fb]/70 hover:border-[#0f7480] focus:border-[#0f7480] focus:ring-[#83d2e4]/40"
                                : "border-white/70 focus:border-[#83d2e4] focus:ring-[#83d2e4]/25",
                            ].join(" ")}
                            min="0"
                            onChange={(event) =>
                              updateTrade(
                                "sell",
                                product.name,
                                event.target.value,
                              )
                            }
                            type="number"
                            value={trade.sell[product.name]}
                          />
                        </label>
                      </div>
                      {sellTooMany ? (
                        <p className="mt-3 text-sm font-bold text-[#0f7480]">
                          賣出數量超過目前持有數量。
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button
                className={`${glassButton} mt-8 px-7 py-4 text-lg`}
                disabled={!canConfirmTrade}
                onClick={confirmTrade}
                type="button"
              >
                確定完成交易
              </button>
            </div>
          ) : null}

          {screen === "result" && roundResult ? (
            <div className="w-full">
              <p className="text-sm font-semibold text-white/85 drop-shadow">公布結果</p>
              <h2 className="mt-2 text-3xl font-black text-white drop-shadow-lg">
                恭喜從{selectedStage}畢業了
              </h2>

              <div className="mt-8 grid gap-4">
                {roundResult.items.map((item) => (
                  <div
                    className={`${beachCard} grid gap-3 p-5 sm:grid-cols-[1fr_7rem_7rem_7rem_7rem] sm:items-center`}
                    key={item.name}
                  >
                    <p className="text-xl font-black text-[#063c43]">
                      {item.name}
                    </p>
                    <p className="font-semibold text-[#115b63]">
                      價格：{item.price} 元
                    </p>
                    <p className="font-semibold text-[#115b63]">
                      買入：{item.buyQuantity}
                    </p>
                    <p className="font-semibold text-[#115b63]">
                      賣出：{item.sellQuantity}
                    </p>
                    <p className="font-black text-[#06434b]">
                      持有：{item.inventoryAfter}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 rounded-lg border border-white/60 bg-[#0f7480]/75 p-6 text-white shadow-xl shadow-[#83d2e4]/25 backdrop-blur-md sm:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-[#dff7fb]">
                    買入花費
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {roundResult.totalBuyCost} 元
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#dff7fb]">
                    賣出收入
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {roundResult.totalSellRevenue} 元
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#dff7fb]">
                    剩餘額
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {roundResult.balanceAfter} 元
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
