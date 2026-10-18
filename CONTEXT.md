# Proyecto Dados Clonados Belicosos

A turn-based territory-conquest game, a fan-made clone of Dice Wars by GAMEDESIGN, played on a map of territories, where armies of dice attack neighbouring territories. One human plays against computer opponents.

## Language

### Map

**Map**:
The playing field, generated randomly for each game, made of **Territories**.
_Avoid_: Board, grid

**Cell**:
The smallest hexagonal unit of the **Map**. Cells are grouped into **Territories**; players never interact with a single Cell.
_Avoid_: Tile, hex

**Territory**:
A connected group of **Cells** owned by exactly one **Player** and holding 1 to 8 **Dice**.
_Avoid_: Area, region, country

**Adjacent**:
Two **Territories** are Adjacent when they share a border. Only Adjacent Territories can attack each other.
_Avoid_: Neighbour, joined

### Players

**Player**:
A participant in the game, either the **Human** or a **Computer**. A game has 2 to 8 Players.

**Human**:
The single person playing the game.

**Computer**:
A **Player** controlled by the game itself.
_Avoid_: AI, bot, CPU (in domain discussions)

**Color**:
The identity of a **Player** on the **Map**. Each Player has one Color from a fixed palette of 8. The **Human** chooses theirs before the game, and the **Computers** receive the remaining ones.

**Game Code**:
A number that fully determines a game: its **Map**, starting **Dice**, **Turn Order** and every dice roll. Playing again with the same Game Code and the same choices replays the same game.
_Avoid_: Seed (in user-facing text)

**Turn Order**:
The random order, fixed at the start of the game, in which **Players** take turns.

**Eliminated**:
A **Player** who owns no **Territories**. Eliminated Players are skipped in the **Turn Order**.

**Dominant Player**:
A **Player** holding more than 40% of all **Dice** on the **Map**. When one exists, **Computers** only make **Attacks** that involve the Dominant Player.

### Combat

**Dice**:
The army strength of a **Territory**. A Territory holds at least 1 and at most 8 Dice.

**Attack**:
A move in which a **Player** uses one of their **Territories** holding 2 or more **Dice** against an **Adjacent** enemy Territory. Both sides roll all their Dice, and the **Attacker** wins only with a strictly greater total.

**Attacker** / **Defender**:
The **Territory** making an **Attack** and the Territory receiving it. Ties go to the Defender.

**Capture**:
The result of a winning **Attack**: the Defender's **Territory** changes owner and receives all of the Attacker's **Dice** but one, while the Attacker's Territory keeps 1. When an Attack fails, the Attacker's Territory drops to 1 Die and the Defender is unchanged.
_Avoid_: Conquest, take

### End of turn

**Largest Group**:
The highest number of a **Player**'s **Territories** that are all connected to each other through **Adjacent** Territories of that Player.
_Avoid_: Connected territories, chain

**Reinforcement**:
The **Dice** a **Player** receives when ending their turn: as many as their **Largest Group**, plus their **Stock**, spread randomly over their **Territories** that hold fewer than 8 Dice.
_Avoid_: Supply, bonus

**Stock**:
**Reinforcement** **Dice** that could not be placed because every **Territory** was full. Stock is kept for later turns, up to a cap of 64.
_Avoid_: Reserve, bank

### Difficulty

**Difficulty**:
How well the **Computers** play: Easy, Normal or Hard. Normal reproduces the original game's behaviour.

## Relationships

- A **Map** contains many **Territories**; a **Territory** contains many **Cells**
- A **Territory** belongs to exactly one **Player** at all times
- Each **Player** has exactly one **Color**; no two Players share a Color
- An **Attack** involves exactly two **Adjacent** **Territories** owned by different **Players**
- **Reinforcement** depends only on the **Largest Group** and the **Stock**, not on the total number of Territories

## Example dialogue

> **Dev:** "If I own 12 **Territories** split into a group of 7 and a group of 5, what's my **Reinforcement**?"
> **Domain expert:** "7 **Dice**, the size of your **Largest Group**, plus anything in your **Stock**. The other 5 Territories don't count."

## Flagged ambiguities

- The project is called **Proyecto Dados Clonados Belicosos**; "Dice Wars" refers only to the original game it clones.
- The original game calls Territories "areas" (エリア). In this project we use **Territory**.
