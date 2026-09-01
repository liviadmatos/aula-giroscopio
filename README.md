# Giroscópio Game

Jogo simples criado com Expo + React Native, em que o jogador controla uma bolinha laranja usando o giroscópio do celular e tenta coletar orbes azuis.

## Como funciona

O objetivo do jogo é coletar o maior número de orbes possíveis dentro do tempo disponível.

- a bolinha laranja representa o jogador
- a bolinha azul representa o alvo
- o sensor do giroscópio controla o movimento da bolinha principal
- ao coletar um orbe, o placar aumenta e o orbe aparece em outra posição

## Movimento

A movimentação foi ajustada para ficar mais natural e estável:

- quando o celular é inclinado para a direita, a bolinha vai para a direita
- quando o celular é inclinado para a esquerda, a bolinha vai para a esquerda
- quando o celular é inclinado para cima, a bolinha desce
- quando o celular é inclinado para baixo, a bolinha sobe

A lógica usa os dados do giroscópio e aplica uma suavização para evitar que o movimento fique brusco ou instável. Em vez de reagir de forma abrupta, a bolinha ganha velocidade progressivamente e mantém um movimento mais fluido.

## Ajustes da versão atual

A versão atual foi refinada em relação à primeira tentativa e apresenta melhorias importantes:

- movimento mais fluido e menos travado
- resposta correta da direção do aparelho
- bloqueio das bordas para que a bolinha não saia da tela
- geração do orbe em posições seguras, sem ficar muito próximo da borda
- contador de tempo e placar para a partida
- tela de início e reinício da partida

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

Este projeto foi desenvolvido como uma demonstração prática de uso do giroscópio em aplicativos móveis, com uma interação simples e visualmente clara.
