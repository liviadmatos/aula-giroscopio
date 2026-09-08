import { Gyroscope } from "expo-sensors";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const PLAYER_SIZE = 52;
const ORB_SIZE = 30;
const PLAYER_MARGIN = 30;
const ORB_MARGIN = 42;
const ARENA_TOP = 120;
const ARENA_BOTTOM_MARGIN = 120;

const GAME_DURATION = 20; // segundos de partida
const COUNTDOWN_DURATION = 3; // segundos de contagem regressiva

// --- Ajustes de física do movimento ---
// Em vez de "teletransportar" a bolinha proporcionalmente ao dado bruto do
// giroscópio (o que causava tremedeira e paradas bruscas), tratamos o tilt
// do celular como ACELERAÇÃO. A bolinha ganha velocidade suavemente e perde
// velocidade aos poucos (fricção), como um objeto real rolando.
const ACCELERATION = 0.7; // o quanto o tilt acelera a bolinha
const FRICTION = 0.93; // 0-1: quanto mais perto de 1, mais "deslizante"
const MAX_SPEED = 6; // velocidade máxima em px por frame
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
        const maxY = height - PLAYER_SIZE - ARENA_BOTTOM_MARGIN;

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Camadas de fundo — a ordem de renderização define o empilhamento
            visual, então não precisamos de zIndex em nenhum lugar. */}
        <View style={styles.glowTopLeft} />
        <View style={styles.glowBottomRight} />
        <View style={styles.arena}>
          <View style={styles.arenaInnerBorder} />
        </View>

        {gameState === "playing" && (
          <>
            <View
              style={[
                styles.orb,
                { left: orbPosition.x, top: orbPosition.y },
              ]}
            >
              <View style={styles.orbHighlight} />
            </View>

            <Animated.View
              style={[
                styles.player,
                {
                  transform: [{ translateX: pos.x }, { translateY: pos.y }],
                },
              ]}
            >
              <View style={styles.playerHighlight} />
            </Animated.View>
          </>
        )}

        {/* HUD renderizado depois da bolinha/orbe para garantir que fique
            sempre visível por cima, sem depender de zIndex. */}
        <View style={styles.hud}>
          <View>
            <Text style={styles.eyebrow}>MINIGAME</Text>
            <Text style={styles.title}>Giroscópio</Text>
          </View>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Tempo</Text>
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
            <View style={[styles.badge, styles.badgeAccent]}>
              <Text style={styles.badgeLabel}>Pontos</Text>
              <Text style={styles.badgeValue}>{score}</Text>
            </View>
          </View>
        </View>

        {gameState === "countdown" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayHint}>Prepare-se</Text>
              <Text style={styles.countdownText}>
                {countdown > 0 ? countdown : "Vai!"}
              </Text>
              <Text style={styles.overlaySubtext}>
                Incline o celular para mover a bolinha
              </Text>
            </View>
          </View>
        )}

        {gameState === "finished" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
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
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050d16",
  },
  container: {
    flex: 1,
    backgroundColor: "#050d16",
  },
  glowTopLeft: {
    position: "absolute",
    top: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 200,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
  },
  glowBottomRight: {
    position: "absolute",
    bottom: -140,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 200,
    backgroundColor: "rgba(255, 127, 80, 0.10)",
  },
  arena: {
    position: "absolute",
    top: 84,
    left: 18,
    right: 18,
    bottom: 26,
    backgroundColor: "rgba(13, 30, 48, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.35)",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  arenaInnerBorder: {
    flex: 1,
    margin: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(224, 242, 254, 0.06)",
  },
  hud: {
    position: "absolute",
    top: Platform.select({ ios: 30, android: 36, default: 32 }),
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(8, 22, 36, 0.92)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.18)",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(125, 211, 252, 0.75)",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f0f9ff",
    letterSpacing: 0.3,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    alignItems: "center",
    minWidth: 62,
  },
  badgeAccent: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(224, 242, 254, 0.55)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  badgeValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f0f9ff",
    marginTop: 1,
  },
  badgeValueUrgent: {
    color: "#fca5a5",
  },
  instructions: {
    position: "absolute",
    top: 96,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(219, 234, 254, 0.85)",
    letterSpacing: 0.2,
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
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#ff7f50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    elevation: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  playerHighlight: {
    position: "absolute",
    top: 6,
    left: 8,
    width: PLAYER_SIZE * 0.4,
    height: PLAYER_SIZE * 0.25,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  orb: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: "#38bdf8",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 14,
    elevation: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  orbHighlight: {
    position: "absolute",
    top: 4,
    left: 5,
    width: ORB_SIZE * 0.35,
    height: ORB_SIZE * 0.22,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 13, 22, 0.82)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    backgroundColor: "rgba(13, 30, 48, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.25)",
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  overlayHint: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(224, 242, 254, 0.6)",
    letterSpacing: 3,
    marginBottom: 14,
    textTransform: "uppercase",
  },
  countdownText: {
    fontSize: 84,
    fontWeight: "800",
    color: "#38bdf8",
    textShadowColor: "rgba(56, 189, 248, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  overlaySubtext: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(224, 242, 254, 0.55)",
    textAlign: "center",
  },
  finishedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e0f2fe",
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  finishedScore: {
    fontSize: 76,
    fontWeight: "800",
    color: "#ff7f50",
    textShadowColor: "rgba(255, 127, 80, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  finishedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(224, 242, 254, 0.7)",
    marginBottom: 32,
    marginTop: 4,
  },
  button: {
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(224, 242, 254, 0.5)",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f0f9ff",
    letterSpacing: 0.3,
  },
});