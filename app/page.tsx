"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
type Screen = "nickname" | "start" | "stage" | "shop" | "result" | "leaderboard";
type ProductNumbers = Record<ProductName, number>;

type Trade = {
  buy: ProductNumbers;
  sell: ProductNumbers;
};

type RoundResult = ReturnType<typeof calculateRound>;

type LeaderboardPlayer = {
  id: string;
  nickname: string;
  balance: number;
  rank: number;
};

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "未知錯誤";
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("nickname");
  const [nicknameInput, setNicknameInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [firestoreError, setFirestoreError] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [inventory, setInventory] = useState<ProductNumbers>({
    ...initialProductNumbers,
  });
  const [completedStages, setCompletedStages] = useState<boolean[]>(
    stages.map(() => false),
  );
  const [selectedStage, setSelectedStage] = useState<Stage>("大一");
  const [trade, setTrade] = useState<Trade>(makeEmptyTrade);
  const [liveBalance, setLiveBalance] = useState(INITIAL_BALANCE);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);

  const selectedStageIndex = stages.indexOf(selectedStage);
  const nextStageIndex = completedStages.findIndex((completed) => !completed);
  const activeStageIndex =
    nextStageIndex === -1 ? stages.length - 1 : nextStageIndex;

  const hasInvalidSell = products.some(
    (product) => trade.sell[product.name] > inventory[product.name],
  );
  const canConfirmTrade = !hasInvalidSell && liveBalance >= 0;
  const allStagesDone = completedStages.every(Boolean);
  const trimmedNickname = nicknameInput.trim();

  useEffect(() => {
    const leaderboardQuery = query(
      collection(db, "players"),
      orderBy("balance", "desc"),
    );

    return onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        let previousBalance: number | null = null;
        let currentRank = 0;

        const players = snapshot.docs.map((playerDoc, index) => {
          const data = playerDoc.data();
          const balance = typeof data.balance === "number" ? data.balance : 0;

          if (previousBalance === null || balance !== previousBalance) {
            currentRank = index + 1;
            previousBalance = balance;
          }

          return {
            id: playerDoc.id,
            nickname:
              typeof data.nickname === "string" ? data.nickname : "未命名",
            balance,
            rank: currentRank,
            storedRank: typeof data.rank === "number" ? data.rank : null,
          };
        });

        setLeaderboard(players);

        const playersNeedingRankUpdate = players.filter(
          (player) => player.storedRank !== player.rank,
        );

        if (playersNeedingRankUpdate.length > 0) {
          const batch = writeBatch(db);

          playersNeedingRankUpdate.forEach((player) => {
            batch.update(doc(db, "players", player.id), {
              rank: player.rank,
              rankedAt: serverTimestamp(),
            });
          });

          batch.commit().catch((error) => {
            console.error("Failed to update leaderboard ranks:", error);
            setFirestoreError(
              `排行榜名次更新失敗：${getErrorMessage(error)}`,
            );
          });
        }
      },
      (error) => {
        console.error("Failed to read leaderboard:", error);
        setFirestoreError(`排行榜讀取失敗：${getErrorMessage(error)}`);
      },
    );
  }, []);

  useEffect(() => {
    if (screen === "result") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [screen]);

  async function submitNickname() {
    if (!trimmedNickname) {
      setFirestoreError("請先輸入暱稱。");
      return;
    }

    setIsSavingNickname(true);
    setFirestoreError("");

    try {
      const playerRef = await addDoc(collection(db, "players"), {
        nickname: trimmedNickname,
        createdAt: serverTimestamp(),
      });

      setPlayerId(playerRef.id);
      setNickname(trimmedNickname);
      setScreen("start");
    } catch (error) {
      console.error("Failed to save nickname:", error);
      setFirestoreError(`暱稱儲存失敗：${getErrorMessage(error)}`);
    } finally {
      setIsSavingNickname(false);
    }
  }

  async function saveFinalScore(finalBalance: number) {
    if (!playerId) {
      setFirestoreError("找不到玩家資料，請重新輸入暱稱。");
      return;
    }

    setIsSavingScore(true);
    setFirestoreError("");

    try {
      await updateDoc(doc(db, "players", playerId), {
        nickname,
        balance: finalBalance,
        completedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to save final score:", error);
      setFirestoreError(`成績儲存失敗：${getErrorMessage(error)}`);
    } finally {
      setIsSavingScore(false);
    }
  }

  function startGame() {
    setBalance(INITIAL_BALANCE);
    setInventory({ ...initialProductNumbers });
    setCompletedStages(stages.map(() => false));
    setSelectedStage("大一");
    setTrade(makeEmptyTrade());
    setLiveBalance(INITIAL_BALANCE);
    setRoundResult(null);
    setScreen("stage");
  }

  function chooseStage(stage: Stage) {
    setSelectedStage(stage);
    setTrade(makeEmptyTrade());
    setLiveBalance(balance);
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

    setTrade((current) => {
      const nextTrade = {
        ...current,
        [action]: {
          ...current[action],
          [productName]: nextValue,
        },
      };
      const hasInvalidSellInNextTrade = products.some(
        (product) => nextTrade.sell[product.name] > inventory[product.name],
      );

      if (!hasInvalidSellInNextTrade) {
        setLiveBalance(
          calculateRound(
            selectedStageIndex,
            nextTrade,
            balance,
            inventory,
          ).balanceAfter,
        );
      }

      return nextTrade;
    });
  }

  function confirmTrade() {
    const result = calculateRound(
      selectedStageIndex,
      trade,
      balance,
      inventory,
    );

    if (!canConfirmTrade || result.balanceAfter < 0) {
      return;
    }

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

    if (selectedStageIndex === stages.length - 1) {
      void saveFinalScore(result.balanceAfter);
    }
  }

  function backToStages() {
    setTrade(makeEmptyTrade());
    setLiveBalance(balance);
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
        </header>

        <section className="flex flex-1 items-center py-10">
          {screen === "nickname" ? (
            <div className="grid w-full gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-white/85 drop-shadow">
                  輸入暱稱
                </p>
                <h2 className="mt-2 text-3xl font-black text-white drop-shadow-lg">
                  開始前先留下你的玩家名稱
                </h2>
                <p className="mt-3 max-w-2xl text-lg font-semibold leading-8 text-white drop-shadow">
                  這個暱稱會用在遊戲結束後的排行榜，最後會依照剩餘額由高到低排序。
                </p>
              </div>

              <div className={`${glassPanel} p-6 text-[#06434b]`}>
                <label htmlFor="player-nickname">
                  <span className="mb-2 block text-sm font-bold text-[#31717a]">
                    暱稱
                  </span>
                  <input
                    className="h-12 w-full rounded-md border border-white/70 bg-white/55 px-4 text-lg font-bold text-[#06434b] outline-none transition focus:border-[#83d2e4] focus:ring-4 focus:ring-[#83d2e4]/25"
                    id="player-nickname"
                    maxLength={20}
                    name="nickname"
                    onChange={(event) => setNicknameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void submitNickname();
                      }
                    }}
                    placeholder="輸入你的暱稱"
                    type="text"
                    value={nicknameInput}
                  />
                </label>

                {firestoreError ? (
                  <p className="mt-3 text-sm font-bold text-[#0f7480]">
                    {firestoreError}
                  </p>
                ) : null}

                <button
                  className={`${glassButton} mt-6 w-full px-7 py-4 text-lg`}
                  disabled={isSavingNickname || !trimmedNickname}
                  onClick={() => void submitNickname()}
                  type="button"
                >
                  {isSavingNickname ? "儲存中..." : "確認暱稱"}
                </button>
              </div>
            </div>
          ) : null}

          {screen === "start" ? (
            <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="max-w-2xl text-lg font-semibold leading-8 text-white drop-shadow">
                  每位玩家一開始都有 30 元。每個年級都有不同商品價格，
                  玩家可以買入或賣出商品，交易頁會顯示當前年級的商品價格。
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
                本頁會顯示{selectedStage}的商品價格；賣出數量不能超過已持有數量。
              </p>

              <div className={`${glassPanel} mt-6 inline-block p-5 text-[#06434b]`}>
                <p className="text-sm font-bold text-[#31717a]">即時餘額</p>
                <p className="mt-1 text-3xl font-black text-[#057486]">
                  {liveBalance} 元
                </p>
                {liveBalance < 0 ? (
                  <p className="mt-2 text-sm font-bold text-[#0f7480]">
                    即時餘額小於 0 元，無法完成交易。
                  </p>
                ) : null}
              </div>

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
                          <p className="mt-1 text-sm font-semibold text-[#0f7480]">
                            {selectedStage} 價格 {stagePrice} 元
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#31717a]">
                            目前持有 {inventory[product.name]} 個
                          </p>
                        </div>
                        <label htmlFor={`${product.name}-buy-quantity`}>
                          <span className="mb-2 block text-sm font-bold text-[#115b63]">
                            買入數量
                          </span>
                          <input
                            className="h-12 w-full rounded-md border border-white/70 bg-white/55 px-4 text-lg font-bold text-[#06434b] outline-none transition focus:border-[#83d2e4] focus:ring-4 focus:ring-[#83d2e4]/25"
                            id={`${product.name}-buy-quantity`}
                            min="0"
                            name={`${product.name}-buy-quantity`}
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
                        <label htmlFor={`${product.name}-sell-quantity`}>
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
                            id={`${product.name}-sell-quantity`}
                            min="0"
                            name={`${product.name}-sell-quantity`}
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

              <button
                className={`${glassButton} mt-8 px-7 py-4 text-lg`}
                disabled={
                  selectedStageIndex === stages.length - 1 && isSavingScore
                }
                onClick={
                  selectedStageIndex === stages.length - 1
                    ? () => setScreen("leaderboard")
                    : backToStages
                }
                type="button"
              >
                {selectedStageIndex === stages.length - 1
                  ? isSavingScore
                    ? "成績儲存中..."
                    : "查看排行榜"
                  : "返回選擇年級"}
              </button>
            </div>
          ) : null}

          {screen === "leaderboard" ? (
            <div className="w-full">
              <p className="text-sm font-semibold text-white/85 drop-shadow">
                排行榜
              </p>
              <h2 className="mt-2 text-3xl font-black text-white drop-shadow-lg">
                餘額排名
              </h2>
              <p className="mt-3 font-semibold text-white drop-shadow">
                每次有玩家提交結果時，排行榜會依照餘額由高到低自動更新。
              </p>

              {firestoreError ? (
                <p className="mt-5 rounded-md border border-white/40 bg-white/30 px-4 py-3 text-sm font-bold text-white backdrop-blur-md">
                  {firestoreError}
                </p>
              ) : null}

              <div className="mt-8">
                {leaderboard.length > 0 ? (
                  <div className={`${beachCard} overflow-hidden text-[#06434b]`}>
                    <table className="w-full table-fixed border-collapse">
                      <thead className="border-b border-white/40 bg-white/35">
                        <tr>
                          <th className="w-20 px-4 py-4 text-left text-sm font-black text-[#0f7480] sm:w-28">
                            排名
                          </th>
                          <th className="px-4 py-4 text-left text-sm font-black text-[#0f7480]">
                            暱稱
                          </th>
                          <th className="w-24 px-4 py-4 text-right text-sm font-black text-[#0f7480] sm:w-32">
                            餘額
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((player) => (
                          <tr
                            className="border-b border-white/30 last:border-b-0"
                            key={player.id}
                          >
                            <td className="px-4 py-4 text-xl font-black">
                              #{player.rank}
                            </td>
                            <td className="truncate px-4 py-4 text-lg font-black">
                              {player.nickname}
                            </td>
                            <td className="px-4 py-4 text-right text-lg font-black text-[#057486]">
                              {player.balance} 元
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`${glassPanel} p-6 text-[#06434b]`}>
                    <p className="text-lg font-bold">目前還沒有提交結果。</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
