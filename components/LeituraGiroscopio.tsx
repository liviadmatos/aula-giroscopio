import { Gyroscope } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const PLAYER_SIZE = 52;
const ORB_SIZE = 30;
const PLAYER_MARGIN = 28;
const ORB_MARGIN = 42;
const ARENA_TOP = 120;
const ARENA_BOTTOM_MARGIN = 28;

const GAME_DURATION = 20; // segundos de partida
const COUNTDOWN_DURATION = 3; // segundos de contagem regressiva

// --- Ajustes de física do movimento ---
// Em vez de "teletransportar" a bolinha proporcionalmente ao dado bruto do
// giroscópio (o que causava tremedeira e paradas bruscas), tratamos o tilt
// do celular como ACELERAÇÃO. A bolinha ganha velocidade suavemente e perde
// velocidade aos poucos (fricção), como um objeto real rolando.
const ACCELERATION = 1.7; // o quanto o tilt acelera a bolinha
const FRICTION = 0.93; // 0-1: quanto mais perto de 1, mais "deslizante"
const MAX_SPEED = 15; // velocidade máxima em px por frame
const SMOOTHING = 0.18; // filtro passa-baixa para remover ruído do sensor

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const generateRandomPosition = () => ({
  x:
    PLAYER_MARGIN +
    Math.random() *
      Math.max(1, width - ORB_SIZE - PLAYER_MARGIN * 2 - ORB_MARGIN),
  y:
    ARENA_TOP +
    Math.random() *
      Math.max(
        1,
        height - ORB_SIZE - ARENA_TOP - ARENA_BOTTOM_MARGIN - ORB_MARGIN,
      ),
});

const getStartPosition = () => ({
  x: (width - PLAYER_SIZE) / 2,
  y: (height - PLAYER_SIZE) / 2 - 20,
});

type GameState = "countdown" | "playing" | "finished";

export default function App() {
  const [gameState, setGameState] = useState<GameState>("countdown");
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [orbPosition, setOrbPosition] = useState(generateRandomPosition());

  // Posição animada (usada via transform, muito mais leve que mexer em left/top)
  const pos = useRef(new Animated.ValueXY(getStartPosition())).current;

  // Refs usados dentro do loop de física, para não depender de re-render do React
  const posRef = useRef(getStartPosition());
  const velRef = useRef({ x: 0, y: 0 });
  const rawGyro = useRef({ x: 0, y: 0 });
  const smoothedGyro = useRef({ x: 0, y: 0 });
  const orbPosRef = useRef(orbPosition);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<GameState>("countdown");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    orbPosRef.current = orbPosition;
  }, [orbPosition]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Assina o giroscópio uma única vez; só guardamos o dado bruto aqui
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const subscribe = async () => {
      try {
        const { status } = await Gyroscope.requestPermissionsAsync();
        if (status !== "granted") return;

        Gyroscope.setUpdateInterval(16);
        subscription = Gyroscope.addListener((gyroscopeData) => {
          rawGyro.current = { x: gyroscopeData.x, y: gyroscopeData.y };
        });
      } catch (error) {
        console.warn("Gyroscope indisponível:", error);
      }
    };

    subscribe();
    return () => subscription?.remove();
  }, []);

  // Loop de física rodando a taxa fixa (requestAnimationFrame), independente
  // da taxa de chegada dos eventos do sensor. É isso que dá a fluidez.
  useEffect(() => {
    const loop = () => {
      // Filtro passa-baixa: suaviza o ruído do sensor em vez de aplicá-lo cru
      smoothedGyro.current.x +=
        (rawGyro.current.x - smoothedGyro.current.x) * SMOOTHING;
      smoothedGyro.current.y +=
        (rawGyro.current.y - smoothedGyro.current.y) * SMOOTHING;

      if (gameStateRef.current === "playing") {
        const ax = smoothedGyro.current.y * ACCELERATION;
        const ay = smoothedGyro.current.x * ACCELERATION;

        velRef.current.x = clamp(
          (velRef.current.x + ax) * FRICTION,
          -MAX_SPEED,
          MAX_SPEED,
        );
        velRef.current.y = clamp(
          (velRef.current.y + ay) * FRICTION,
          -MAX_SPEED,
          MAX_SPEED,
        );

        let nextX = posRef.current.x + velRef.current.x;
        let nextY = posRef.current.y + velRef.current.y;

        const minX = PLAYER_MARGIN;
        const maxX = width - PLAYER_SIZE - PLAYER_MARGIN;
        const minY = ARENA_TOP;
        const maxY = height - PLAYER_SIZE - ARENA_BOTTOM_MARGIN - 10;

        if (nextX < minX) {
          nextX = minX;
          velRef.current.x = 0;
        }
        if (nextX > maxX) {
          nextX = maxX;
          velRef.current.x = 0;
        }
        if (nextY < minY) {
          nextY = minY;
          velRef.current.y = 0;
        }
        if (nextY > maxY) {
          nextY = maxY;
          velRef.current.y = 0;
        }

        posRef.current = { x: nextX, y: nextY };
        pos.setValue(posRef.current);

        // Checagem de colisão com o orbe
        const playerCenterX = nextX + PLAYER_SIZE / 2;
        const playerCenterY = nextY + PLAYER_SIZE / 2;
        const orbCenterX = orbPosRef.current.x + ORB_SIZE / 2;
        const orbCenterY = orbPosRef.current.y + ORB_SIZE / 2;
        const dx = playerCenterX - orbCenterX;
        const dy = playerCenterY - orbCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < PLAYER_SIZE / 2 + ORB_SIZE / 2 + 6) {
          const newOrb = generateRandomPosition();
          orbPosRef.current = newOrb;
          setOrbPosition(newOrb);
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [pos]);

  // Contagem regressiva de início (3, 2, 1, Vai!)
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown <= 0) {
      setGameState("playing");
      return;
    }
    const timeout = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timeout);
  }, [gameState, countdown]);

  // Timer da partida
  useEffect(() => {
    if (gameState !== "playing") return;
    if (timeLeft <= 0) {
      setGameState("finished");
      return;
    }
    const timeout = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timeout);
  }, [gameState, timeLeft]);

  const handleRestart = () => {
    const startPos = getStartPosition();
    posRef.current = startPos;
    velRef.current = { x: 0, y: 0 };
    smoothedGyro.current = { x: 0, y: 0 };
    pos.setValue(startPos);

    const newOrb = generateRandomPosition();
    orbPosRef.current = newOrb;
    setOrbPosition(newOrb);

    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setCountdown(COUNTDOWN_DURATION);
    setGameState("countdown");
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGlow} />
      <View style={styles.arena} />

      <View style={styles.hud}>
        <Text style={styles.title}>Giroscópio Game</Text>
        <View style={styles.badgesRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>TEMPO</Text>
            <Text
              style={[
                styles.badgeValue,
                timeLeft <= 5 &&
                  gameState === "playing" &&
                  styles.badgeValueUrgent,
              ]}
            >
              {timeLeft}s
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>PONTOS</Text>
            <Text style={styles.badgeValue}>{score}</Text>
          </View>
        </View>
      </View>

      {gameState === "playing" && (
        <>
          <Text style={styles.instructions}>Colete o orbe azul!</Text>

          <View
            style={[styles.orb, { left: orbPosition.x, top: orbPosition.y }]}
          />

          <Animated.View
            style={[
              styles.player,
              {
                transform: [{ translateX: pos.x }, { translateY: pos.y }],
              },
            ]}
          />
        </>
      )}

      {gameState === "countdown" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayHint}>Prepare-se</Text>
          <Text style={styles.countdownText}>
            {countdown > 0 ? countdown : "Vai!"}
          </Text>
        </View>
      )}

      {gameState === "finished" && (
        <View style={styles.overlay}>
          <Text style={styles.finishedTitle}>Tempo esgotado!</Text>
          <Text style={styles.finishedScore}>{score}</Text>
          <Text style={styles.finishedLabel}>
            {score === 1 ? "orbe coletado" : "orbes coletados"}
          </Text>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={handleRestart}
          >
            <Text style={styles.buttonText}>Jogar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06131f",
  },
  backgroundGlow: {
    position: "absolute",
    top: -120,
    left: -80,
    right: -80,
    height: 300,
    backgroundColor: "rgba(52, 152, 219, 0.22)",
    borderRadius: 200,
  },
  arena: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: "rgba(15, 35, 55, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.5)",
    borderRadius: 30,
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  hud: {
    position: "absolute",
    top: 36,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e0f2fe",
    letterSpacing: 0.5,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 10,
  },
  badge: {
    backgroundColor: "rgba(14, 116, 144, 0.55)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.6)",
    alignItems: "center",
    minWidth: 64,
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(224, 242, 254, 0.7)",
    letterSpacing: 1,
  },
  badgeValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f0f9ff",
  },
  badgeValueUrgent: {
    color: "#fca5a5",
  },
  instructions: {
    position: "absolute",
    top: 82,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#dbeafe",
    zIndex: 2,
  },
  player: {
    position: "absolute",
    top: 0,
    left: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
    backgroundColor: "#ff7f50",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#ff7f50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 2,
  },
  orb: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: "#38bdf8",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 2,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 19, 31, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  overlayHint: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(224, 242, 254, 0.7)",
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  countdownText: {
    fontSize: 96,
    fontWeight: "800",
    color: "#38bdf8",
    textShadowColor: "rgba(56, 189, 248, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  finishedTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#e0f2fe",
    marginBottom: 16,
  },
  finishedScore: {
    fontSize: 88,
    fontWeight: "800",
    color: "#ff7f50",
    textShadowColor: "rgba(255, 127, 80, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  finishedLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(224, 242, 254, 0.75)",
    marginBottom: 36,
  },
  button: {
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.8)",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f0f9ff",
    letterSpacing: 0.5,
  },
});
