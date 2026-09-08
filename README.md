# Giroscópio Game

Jogo simples criado com Expo + React Native, em que o jogador controla uma bolinha laranja usando o giroscópio do celular e tenta coletar orbes azuis.

## Como funciona

O objetivo do jogo é coletar o maior número de orbes azuis possíveis em 20 segundos, controlando a bolinha laranja com o giroscópio do seu celular.

- **Bolinha laranja**: representa o jogador, controlada pelo giroscópio
- **Orbe azul**: o alvo que você precisa coletar
- **Giroscópio**: sensor que detecta a inclinação do celular para controlar o movimento
- **Pontos**: aumentam cada vez que você coleta um orbe
- **Tempo**: você tem 20 segundos para coletar o máximo de orbes possível

## Movimento

A movimentação foi ajustada para ficar mais natural e estável:

- quando o celular é inclinado para a direita, a bolinha vai para a direita
- quando o celular é inclinado para a esquerda, a bolinha vai para a esquerda
- quando o celular é inclinado para cima, a bolinha sobe
- quando o celular é inclinado para baixo, a bolinha desce

A lógica usa os dados do giroscópio e aplica uma suavização para evitar que o movimento fique brusco ou instável. Em vez de reagir de forma abrupta, a bolinha ganha velocidade progressivamente e mantém um movimento mais fluido com fricção natural.

## Como jogar

1. O jogo inicia com uma contagem regressiva de 3 segundos
2. Incline o celular para mover a bolinha laranja
3. Colida com os orbes azuis para ganhar pontos
4. Você tem 20 segundos para coletar o máximo de orbes
5. Ao final, veja sua pontuação e reinicie se desejar

## Ajustes da versão atual

A versão atual foi refinada com os seguintes melhorias:

- movimento mais fluido com aceleração controlada (velocidade máxima de 6 px/frame)
- resposta correta da direção do aparelho
- margens de segurança ampliadas para manter a bolinha bem dentro da arena
- bloqueio seguro das bordas para que a bolinha não saia da tela
- geração do orbe em posições seguras, sem ficar próximo das bordas
- contador de tempo (20 segundos por partida) e placar atualizado em tempo real
- tela de contagem regressiva antes do jogo iniciar
- tela de fim de jogo com resultado final
- interface limpa sem distrações

## Como iniciar

1. Instale as dependências:

```bash
npm install
```

2. Inicie o projeto:

```bash
npx expo start
```

3. Abra no emulador ou no dispositivo com Expo Go.

## Tecnologias usadas

- React Native
- Expo
- expo-sensors
- JavaScript / TypeScript

## Objetivo do projeto

Este projeto foi desenvolvido como uma demonstração prática de uso do giroscópio em aplicativos móveis com React Native + Expo, apresentando uma mecânica de jogo simples, visualmente clara e responsiva aos movimentos do celular. É um exemplo funcional de como implementar sensores de movimento em aplicações Expo.
