"use client";

import { useState } from "react";

const INITIAL_BALANCE = 30;

const stages = ["大一", "大二", "大三", "大四"] as const;

const products = [
  { name: "商品A", prices: [3, 5, 1, 2] },
  { name: "商品B", prices: [1, 2, 1, 4] },
  { name: "商品C", prices: [1, 3, 3, 6] },
] as const;

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
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-8 text-stone-950 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Graduation Market
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-5xl">
              畢業採購遊戲
            </h1>
          </div>
          {screen !== "start" ? (
            <button
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-stone-500"
              onClick={backToStages}
              type="button"
            >
              返回選擇年級
            </button>
          ) : null}
        </header>

        <section className="flex flex-1 items-center py-10">
          {screen === "start" ? (
            <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-lg leading-8 text-stone-700">
                  每位玩家一開始都有 30 元。每個年級都有不同商品價格，
                  玩家可以買入或賣出商品，但價格要等本回合結束才公布。
                </p>
                <button
                  className="mt-8 rounded-md bg-emerald-700 px-7 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800"
                  onClick={startGame}
                  type="button"
                >
                  開始遊戲
                </button>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/5">
                <p className="text-sm font-semibold text-stone-500">
                  初始餘額
                </p>
                <p className="mt-3 text-6xl font-black text-emerald-700">
                  {INITIAL_BALANCE} 元
                </p>
                <div className="mt-8 grid grid-cols-4 gap-2">
                  {stages.map((stage) => (
                    <span
                      className="rounded-md bg-stone-100 px-3 py-2 text-center text-sm font-semibold"
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
                  <p className="text-sm font-semibold text-emerald-700">
                    選擇年級
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">
                    依序完成大一到大四
                  </h2>
                </div>
                <div className="rounded-lg bg-white px-5 py-4 shadow-sm">
                  <p className="text-sm font-semibold text-stone-500">
                    目前餘額
                  </p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">
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
                        "rounded-lg border p-6 text-left shadow-sm transition",
                        isCompleted
                          ? "cursor-not-allowed border-stone-200 bg-stone-200 text-stone-400"
                          : "",
                        !isCompleted && isLocked
                          ? "cursor-not-allowed border-stone-200 bg-white text-stone-400 opacity-60"
                          : "",
                        !isCompleted && !isLocked
                          ? "border-stone-200 bg-white hover:-translate-y-1 hover:border-emerald-700 hover:shadow-lg"
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
                <div className="mt-8 rounded-lg bg-emerald-800 p-6 text-white">
                  <p className="text-lg font-bold">四個階段都完成了</p>
                  <p className="mt-2 text-4xl font-black">最終餘額 {balance} 元</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {screen === "shop" ? (
            <div className="w-full">
              <p className="text-sm font-semibold text-emerald-700">
                {selectedStage} 交易
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                選擇這一回合要買入或賣出的數量
              </h2>
              <p className="mt-3 text-stone-600">
                本頁不顯示商品價格與目前餘額；賣出數量不能超過已持有數量。
              </p>

              <div className="mt-8 grid gap-4">
                {products.map((product) => {
                  const sellTooMany =
                    trade.sell[product.name] > inventory[product.name];

                  return (
                    <div
                      className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
                      key={product.name}
                    >
                      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_12rem] sm:items-end">
                        <div>
                          <p className="text-xl font-bold">{product.name}</p>
                          <p className="mt-1 text-sm text-stone-500">
                            目前持有 {inventory[product.name]} 個
                          </p>
                        </div>
                        <label>
                          <span className="mb-2 block text-sm font-semibold text-stone-600">
                            買入數量
                          </span>
                          <input
                            className="h-12 w-full rounded-md border border-stone-300 px-4 text-lg font-semibold outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
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
                          <span className="mb-2 block text-sm font-semibold text-stone-600">
                            賣出數量
                          </span>
                          <input
                            className={[
                              "h-12 w-full rounded-md border px-4 text-lg font-semibold outline-none transition focus:ring-4",
                              sellTooMany
                                ? "border-red-500 focus:border-red-600 focus:ring-red-600/10"
                                : "border-stone-300 focus:border-emerald-700 focus:ring-emerald-700/10",
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
                        <p className="mt-3 text-sm font-semibold text-red-600">
                          賣出數量超過目前持有數量。
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <button
                className="mt-8 rounded-md bg-stone-950 px-7 py-4 text-lg font-bold text-white shadow-lg shadow-stone-900/15 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
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
              <p className="text-sm font-semibold text-emerald-700">
                公布結果
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                恭喜從{selectedStage}畢業了
              </h2>

              <div className="mt-8 grid gap-4">
                {roundResult.items.map((item) => (
                  <div
                    className="grid gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_7rem_7rem_7rem_7rem] sm:items-center"
                    key={item.name}
                  >
                    <p className="text-xl font-bold">{item.name}</p>
                    <p className="text-stone-700">價格：{item.price} 元</p>
                    <p className="text-stone-700">
                      買入：{item.buyQuantity}
                    </p>
                    <p className="text-stone-700">
                      賣出：{item.sellQuantity}
                    </p>
                    <p className="font-semibold">
                      持有：{item.inventoryAfter}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-4 rounded-lg bg-emerald-800 p-6 text-white sm:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">
                    買入花費
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {roundResult.totalBuyCost} 元
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-100">
                    賣出收入
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {roundResult.totalSellRevenue} 元
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-100">
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
