"""Tools for creating pairings for a competition according to the SimKro system.

In a SimKro competition, the players in each round are paired according to their
'saldo'. The saldo is the difference between the won and lost games of a player. The
goals of the system is create pairings such that:
    - players are paired against opponents with similar saldo.
    - players end up with approximately the same number of white and black games.
    - players don't play too many games against the same opponent and not too quickly
    in succesion.

Definitions
-----------
- saldo: The number of games a player won minus the number of games a player lost. So
draws have no effect on the saldo, and the saldo can be both a negative or a postive
number.
- color saldo: The number of white games minus the number of black games.
- turnus: A set of rounds in which two opponents can only be paired limited times. The
competition lasts 30 rounds and rounds 1-10, 11-20 and 21-30 form a turnus. So two
players can be paired a maximum of three times against each other, once in rounds 1-10,
once in rounds 11-20, once in rounds 21-30. If they did not get paired in rounds 1-10 it
is possible they get paired twice in round 11-20.
- point total: The final ranking is made using the point total. It is calculated using
the following formula:
```
point_total = 500 + result_score + attendance_score + opponent_saldo
```
The result score starts at 0. For the first 20 games, the result score increases by 12
for a win and decreases by 12 for a loss. After that, the result score increases or
decreases by 6.
The attendance score starts at 0. It increases by 3 for each game played, up to a
maximum of 60.
The opponent saldo is the total of the saldo of the opponent of each game played by a
player, with a maximum of 6 per match. It is the current saldo, and not the saldo at the
time of playing.
- penalty score: A score to determine how suitable a pairing between two players is. The
penalty score is calculated as:
```
penalty_score = (
    ( saldo difference )^2 - 0.5 * ( absolute color saldo difference ) +
    0.001 * ( absolute point total difference ) +
    0.0001 * ( random number between 0 and 1) +
    100 * ( number of games less than 4 since last time opponent were paired )
)
```
If the two opponents already played against each other the same number of times as the
number of turnus, then they can't be paired again.

Pairing
-------
The pairing of players in a round of a SimKro competition goes in the following steps:

1. If the number of players is odd, no pairing is possible. One player should be added
or removed before a pairing is possible.
2. Sort the players in a descending order according to their saldo.
3. Take the player with the highest saldo and pair them against the most suitable
opponent. Here most suitable means the opponent with the lowest penalty score.
4. Take the player with the lowest saldo and pair them agains the most suitable
opponent.
5. Repeat steps 3. and 4. until there are 10 players left.
6. Calculate the penalty scores for all possible pairing between these 10 players and
take the pairing that has the lowest total penalty score.
"""

import itertools
import random
from collections import defaultdict
from typing import Literal

from backend.models import Competition, Match, Player, Result, SimkroRank

# The number of rounds that scores are influenced by a high amount. This has influence
# on attendence scores, results scores, etc.
N_ROUNDS_HIGH = 20
# The result score gaining by winning in the start rounds.
RESULT_SCORE_HIGH = 12
# The result score gaining by winning after the start rounds.
RESULT_SCORE_LOW = 6
# The number of rounds a player gains attendance points and the number of points per
# round.
N_ROUNDS_ATTENDANCE = 20
ATTENDANCE_SCORE = 3
# Maximum ammount that an opponents saldo counts when calculating the point total.
MAX_OPPONENT_SALDO = 6
# Number of rounds in a turnus.
N_ROUNDS_TURNUS = 10
# Penalty for playing twice in the same turnus.
TURNUS_PENALTY = 10000
# Penalty for each game less than N_GAMES_BETWEEN .
GAMES_BETWEEN_PENALTY = 100
# Number of games a player needs to have played before being able to play an opponent
# again without a penalty.
N_GAMES_BETWEEN = 4
# The weight given to the color and point part of the penalty score.
PENALTY_COLOR_WEIGHT = 0.5
PENALTY_POINT_WEIGHT = 0.001
# Seed for random number generation.
RANDOM_SEED = 16843
RNG = random.Random(RANDOM_SEED)
# Weight given to the random factor in the penalty score.
RANDOM_PENALTY_WEIGHT = 0.0001
# Start finding the optimal pairing for the remaining players if there are only this
# many players left.
OPTIMAL_PAIRING_THRESHOLD = 10


def calculate_saldo(matches: list[Match]) -> defaultdict[Player, int]:
    """Calculate the saldo for all players in a list of matches.

    The saldo of a player is the number of matches won minus the matches lost.

    Parameters
    ----------
    matches : list[Match]
        List of matches based on which to calculate the saldo.

    Returns
    -------
    defaultdict[Player, int]
        Default dictionary {player: saldo} with the default value 0.
    """
    saldo = defaultdict(int)
    for m in matches:
        match m.result:
            case Result.WHITE_WIN:
                saldo[m.player_white] += 1
                saldo[m.player_black] -= 1
            case Result.BLACK_WIN:
                saldo[m.player_white] -= 1
                saldo[m.player_black] += 1
            case _:
                pass
    return saldo


def calculate_color_saldo(matches: list[Match]) -> defaultdict[Player, int]:
    """Calculate the color saldo for all players in a list of matches.

    The color saldo of a player is the number of white games minus black games.

    Parameters
    ----------
    matches : list[Match]
        List of matches based on which to calculate the color saldo.

    Returns
    -------
    defaultdict[Player, int]
        Default dictionary {player: color_saldo} with the default value 0.
    """
    color_saldo = defaultdict(int)
    for m in matches:
        color_saldo[m.player_white] += 1
        color_saldo[m.player_black] -= 1
    return color_saldo


def calculate_result_score(matches: list[Match]) -> defaultdict[Player, int]:
    """Calculate the result score for all players in a list of matches.

    The result score starts at 0. The first `N_ROUND_HIGH` rounds, it increases or
    decreases by `RESULT_SCORE_HIGH` point based on a win or a loss. After that it
    changes by `RESULT_SCORE_LOW`. A draw does not affect the result score.

    Parameters
    ----------
    matches : list[Match]
        List of matches based on which to calculate the result score.

    Returns
    -------
    defaultdict[Player, int]
        Default dictionary {player: result_score} with the default value 0.
    """
    score = defaultdict(int)
    n_rounds_attended = defaultdict(int)
    for m in matches:
        n_rounds_attended[m.player_white] += 1
        n_rounds_attended[m.player_black] += 1
        multiplier_white = (
            RESULT_SCORE_HIGH
            if n_rounds_attended[m.player_white] <= N_ROUNDS_HIGH
            else RESULT_SCORE_LOW
        )
        multiplier_black = (
            RESULT_SCORE_HIGH
            if n_rounds_attended[m.player_black] <= N_ROUNDS_HIGH
            else RESULT_SCORE_LOW
        )
        match m.result:
            case Result.WHITE_WIN:
                score[m.player_white] += multiplier_white
                score[m.player_black] -= multiplier_black
            case Result.BLACK_WIN:
                score[m.player_white] -= multiplier_white
                score[m.player_black] += multiplier_black
            case _:
                pass
    return score


def calculate_attendance_score(matches: list[Match]) -> defaultdict[Player, int]:
    """Calculate the attendance score for all players in a list of matches.

    The attendance score is `ATTENDANCE_SCORE` points for each of the first
    `N_ROUNDS_ATTENDANCE` games.

    Parameters
    ----------
    matches : list[Match]
        List of matches based on which to calculate the attendance score.

    Returns
    -------
    defaultdict[Player, int]
        Default dictionary {player: attendance_score} with the default value 0.
    """
    score = defaultdict(int)
    max_score = N_ROUNDS_ATTENDANCE * ATTENDANCE_SCORE
    for m in matches:
        score[m.player_white] = min(score[m.player_white] + ATTENDANCE_SCORE, max_score)
        score[m.player_black] = min(score[m.player_black] + ATTENDANCE_SCORE, max_score)
    return score


def min_max(n: int, val_min: int, val_max: int) -> int:
    """Apply a maximum and a minimum at the same time."""
    return max(val_min, min(val_max, n))


def calculate_opponent_saldo(matches: list[Match]) -> defaultdict[Player, int]:
    """For each player calculate the total opponent saldo from a list of matches.

    The opponent saldo is the sum of the saldo's of the opponents of a player. If a
    player faced the same opponent multiple times, the saldo will count multiple times.
    The contribution of a single opponent is capped between `-MAX_OPPONENT_SALDO` and
    `MAX_OPPONENT_SALDO`.

    Parameters
    ----------
    matches : list[Match]
        List of matches based on which to calculate the opponent saldo.

    Returns
    -------
    defaultdict[Player, int]
        Default dictionary {player: opponent_saldo} with the default value 0.
    """
    saldo = calculate_saldo(matches)

    score = defaultdict(int)
    for m in matches:
        score[m.player_white] += min_max(
            saldo[m.player_black], -MAX_OPPONENT_SALDO, MAX_OPPONENT_SALDO
        )
        score[m.player_black] += min_max(
            saldo[m.player_white], -MAX_OPPONENT_SALDO, MAX_OPPONENT_SALDO
        )
    return score


def calculate_point_total(matches: list[Match]) -> defaultdict[Player, int]:
    """For each player calculate the point total.

    The point total of a players is defined as
    ```
    point_total = 500 + result_score + attendance_score + opponent_saldo
    ```

    Parameters
    ----------
    matches : list[Match]
        List of matches based on which to calculate the point total.

    Returns
    -------
    defaultdict[Player, int]
        Default dictionary {player: point_total} with the default value 500.
    """
    attendence_score = calculate_attendance_score(matches)
    result_score = calculate_result_score(matches)
    opponent_saldo = calculate_opponent_saldo(matches)
    point_total = defaultdict(lambda: 500)
    for player in attendence_score:
        point_total[player] += (
            attendence_score[player] + result_score[player] + opponent_saldo[player]
        )
    return point_total


def played_in_turnus_pairs(
    matches: list[Match], round_nr: int
) -> set[frozenset[Player]]:
    """Get the pairs of players that already played once for each turnus.

    Note that multiple matches between two players can happen in the same turnus if they
    did not play against each other in the previous turnus.

    Parameters
    ----------
    matches : list[Match]
        List of matches.
    round_nr : int
        Number of the round.

    Returns
    -------
    set[frozenset[Player]]
        Set of symmetric pairs {player1, player2} of players that have played a match
        for each turnus.
    """
    # Round nr starts counting from 1, not 0.
    turnus_nr = ((round_nr - 1) // N_ROUNDS_TURNUS) + 1

    n_games_played = defaultdict(int)
    for m in matches:
        n_games_played[frozenset((m.player_white, m.player_black))] += 1

    return {pair for pair, n_games in n_games_played.items() if n_games >= turnus_nr}


def calculate_games_since_last_played(
    matches: list[Match],
) -> defaultdict[Player, defaultdict[Player, int]]:
    """For each player and opponent get the number of played since playing the opponent.

    Parameters
    ----------
    matches : list[Match]
        List of matches.

    Returns
    -------
    defaultdict[Player, defaultdict[Player, int]]
        Default dict `{player: {opponent: n_games_since_last_played}}`, where
        `n_games_since_last_played` is the number of games that the played played since
        meeting the opponent, with a maximum of `N_GAMES_BETWEEN. The default value
        of the inner default dict is `N_GAMES_BETWEEN`.
    """
    games_since_last_played = defaultdict(lambda: defaultdict(lambda: N_GAMES_BETWEEN))
    n_games_between = defaultdict(int)
    for m in sorted(matches, key=lambda match_obj: match_obj.round, reverse=True):
        # If an opponent occurs multiple times, we take the last round.
        # We don't need to look further than `N_GAMES_BETWEEN` games in the past.
        if (
            n_games_between[m.player_white] < N_GAMES_BETWEEN
            and m.player_black not in games_since_last_played[m.player_white]
        ):
            games_since_last_played[m.player_white][m.player_black] = n_games_between[
                m.player_white
            ]
        if (
            n_games_between[m.player_black] < N_GAMES_BETWEEN
            and m.player_white not in games_since_last_played[m.player_black]
        ):
            games_since_last_played[m.player_black][m.player_white] = n_games_between[
                m.player_black
            ]
        n_games_between[m.player_white] += 1
        n_games_between[m.player_black] += 1
    return games_since_last_played


def calculate_base_penalty_score(
    matches: list[Match], players: list[Player]
) -> defaultdict[frozenset[Player], float]:
    """The base penalty score for pairs from a list of players.

    The base penalty score for a pair of players is defined as:
    ```
    base_penalty_score = (
        saldo_difference**2
        - 0.5 * abs(color_saldo_difference)
        + 0.001 * abs(point_total_difference)
    )
    ```

    Parameters
    ----------
    matches : list[Match]
        List of matches.
    players : list[Player]
        List of players.

    Returns
    -------
    defaultdict[frozenset[Player], float]
        Dictionary {{pair_of_players} : penalty score} for each pair of players from the
        input list of players.
    """
    penalty_score = {}
    saldo = calculate_saldo(matches)
    color_saldo = calculate_color_saldo(matches)
    point_total = calculate_point_total(matches)
    for player1, player2 in itertools.combinations(players, 2):
        saldo_diff = saldo[player1] - saldo[player2]
        color_diff = color_saldo[player1] - color_saldo[player2]
        point_diff = point_total[player1] - point_total[player2]
        penalty_score[frozenset((player1, player2))] = (
            saldo_diff**2
            - PENALTY_COLOR_WEIGHT * abs(color_diff)
            + PENALTY_POINT_WEIGHT * abs(point_diff)
        )
    return penalty_score


def calculate_penalty_score(
    matches: list[Match], players: list[Player]
) -> dict[Player, dict[Player, float]]:
    """Calculate the full penalty score for all pairs from a list of players.

    The penalty score for a directed pair (player1 → player2) is:
    ```
    penalty_score = (
        base_penalty_score
        + TURNUS_PENALTY * already_played_in_turnus
        + GAMES_BETWEEN_PENALTY * max(0, N_GAMES_BETWEEN - games_since_last_played)
        + RANDOM_PENALTY_WEIGHT * random()
    )
    ```
    If no previous matches exist, only the random component is returned.

    Parameters
    ----------
    matches : list[Match]
        Matches played before the round being paired.
    players : list[Player]
        Players participating in the round to be paired.

    Returns
    -------
    dict[Player, dict[Player, float]]
        Nested dict `{player: {opponent: penalty}}` for every ordered pair of
        players.
    """
    penalty_score = {}
    if not matches:
        for player1, player2 in itertools.combinations(players, 2):
            penalty_score.setdefault(player1, {})[player2] = (
                RANDOM_PENALTY_WEIGHT * RNG.random()
            )
            penalty_score.setdefault(player2, {})[player1] = (
                RANDOM_PENALTY_WEIGHT * RNG.random()
            )
        return penalty_score
    base_penalty_score = calculate_base_penalty_score(matches, players)
    current_round = max(m.round for m in matches) + 1
    turnus_pairs = played_in_turnus_pairs(matches, current_round)
    n_games_between = calculate_games_since_last_played(matches)
    for player1, player2 in itertools.combinations(players, 2):
        pair = frozenset((player1, player2))
        # The number of games between is not symmetric: one player can have played a
        # different number of games than the other since the last time they met. So we
        # pick the minimum of the two values.
        games_between = min(
            n_games_between[player1][player2], n_games_between[player2][player1]
        )
        penalty_score.setdefault(player1, {})[player2] = (
            base_penalty_score[pair]
            + TURNUS_PENALTY * (pair in turnus_pairs)
            + GAMES_BETWEEN_PENALTY * max(0, N_GAMES_BETWEEN - games_between)
            + RANDOM_PENALTY_WEIGHT * RNG.random()
        )
        penalty_score.setdefault(player2, {})[player1] = (
            base_penalty_score[pair]
            + TURNUS_PENALTY * (pair in turnus_pairs)
            + GAMES_BETWEEN_PENALTY * max(0, N_GAMES_BETWEEN - games_between)
            + RANDOM_PENALTY_WEIGHT * RNG.random()
        )
    return penalty_score


def pick_color(
    player1: Player,
    color_score1: int,
    player2: Player,
    color_score2: int,
    previous_matches: list[Match],
) -> dict[Literal["white", "black"], Player]:
    """Pick colors in a matchup.

    Parameters
    ----------
    player1 : Player
        First player.
    color_score1 : int
        Color score of first player.
    player2 : Player
        Second player.
    color_score2 : int
        Color score of second player.
    previous_matches : list[Match]
        List of previous matches between the two players.

    Returns
    -------
    dict[Literal["white", "black"], Player]:
        Dictionary {"white": player, "black": other_player}. The person with the lower
        color score gets white. If the color scores are equal, the person with the lower
        number of previous white games gets white. Otherwise the colors are randomly
        picked.
    """
    if color_score1 > color_score2:
        return {"white": player2, "black": player1}
    elif color_score1 < color_score2:
        return {"white": player1, "black": player2}
    else:
        n_games_white_p1 = sum(m.player_white == player1 for m in previous_matches)
        if n_games_white_p1 < len(previous_matches) / 2:
            return {"white": player1, "black": player2}
        elif n_games_white_p1 > len(previous_matches) / 2:
            return {"white": player2, "black": player1}
        # Choose randomly
        elif RNG.random() > 0.5:
            return {"white": player1, "black": player2}
        else:
            return {"white": player2, "black": player1}


def _calculate_all_pairings(
    players: list[Player],
) -> list[list[tuple[Player, Player]]]:
    if len(players) % 2 == 1:
        raise ValueError(
            f"Number of players should be even. len(players): {len(players)}"
        )
    if len(players) == 2:
        # Base case: if only two items left, one pair can be formed
        return [[tuple(players)]]

    all_partitions = []
    for pair in itertools.combinations(players, 2):
        # Form a pair and partition the rest recursively
        remaining = [player for player in players if player not in pair]
        for sub_partition in _calculate_all_pairings(remaining):
            all_partitions.append([pair] + sub_partition)

    return all_partitions


def _total_penalty_score(
    pairing: list[tuple[Player, Player]],
    penalty_score: dict[Player, dict[Player, float]],
) -> float:
    return sum(
        penalty_score[pair[0]][pair[1]] + penalty_score[pair[1]][pair[0]]
        for pair in pairing
    )


def _pick_color_from_lists(
    player1: Player,
    player2: Player,
    color_saldo: defaultdict[Player, int],
    matches: list[Match],
) -> dict[Literal["white", "black"], Player]:
    previous_matchups = [
        m for m in matches if {m.player_white, m.player_black} == {player1, player2}
    ]
    return pick_color(
        player1=player1,
        color_score1=color_saldo[player1],
        player2=player2,
        color_score2=color_saldo[player2],
        previous_matches=previous_matchups,
    )


def create_matchups(
    matches: list[Match], players: list[Player], round_nr: int, competition: Competition
) -> list[Match]:
    # Step 1: Set up the data.
    if len(players) % 2 == 1:
        raise ValueError(
            f"Number of players should be even. len(players): {len(players)}"
        )
    saldo = calculate_saldo(matches)
    color_saldo = calculate_color_saldo(matches)
    penalty_score = calculate_penalty_score(matches, players)
    # Step 2
    # Make sure we don't mutate the input list:
    players = players.copy()
    players.sort(key=lambda p: saldo[p], reverse=True)
    matchups = []
    # Step 3, 4 and 5: Alternatingly create the best matchup for the highest and lowest
    # saldo player until there are only a few left.
    pair_best = True
    board_nr = 1
    while len(players) > OPTIMAL_PAIRING_THRESHOLD:
        if pair_best:
            player = players.pop(0)
        else:
            player = players.pop(-1)
        best_opponent_idx = min(
            enumerate(players), key=lambda x: penalty_score[player][x[1]]
        )[0]
        opponent = players.pop(best_opponent_idx)
        assert len(players) % 2 == 0
        player_colors = _pick_color_from_lists(
            player1=player,
            player2=opponent,
            color_saldo=color_saldo,
            matches=matches,
        )
        matchups.append(
            Match(
                player_white=player_colors["white"],
                player_black=player_colors["black"],
                competition=competition,
                round=round_nr,
                board=board_nr,
            )
        )
        board_nr += 1
        pair_best = not pair_best

    # Step 6: Calculate all remaining pairings.
    all_remaining_pairings = _calculate_all_pairings(players)
    best_remaining_pairing = min(
        all_remaining_pairings,
        key=lambda pairing: _total_penalty_score(
            pairing=pairing, penalty_score=penalty_score
        ),
    )
    for player1, player2 in best_remaining_pairing:
        player_colors = _pick_color_from_lists(
            player1=player1,
            player2=player2,
            color_saldo=color_saldo,
            matches=matches,
        )
        matchups.append(
            Match(
                player_white=player_colors["white"],
                player_black=player_colors["black"],
                competition=competition,
                round=round_nr,
                board=board_nr,
            )
        )
        board_nr += 1
    return matchups


def calculate_games_played(matches: list[Match]) -> defaultdict[Player, int]:
    output = defaultdict(int)
    for m in matches:
        output[m.player_white] += 1
        output[m.player_black] += 1
    return output


def calculate_win_draw_loss(
    matches: list[Match],
) -> defaultdict[Player, list[int]]:
    output = defaultdict(lambda: [0, 0, 0])
    for m in matches:
        match m.result:
            case Result.WHITE_WIN:
                output[m.player_white][0] += 1
                output[m.player_black][2] += 1
            case Result.DRAW:
                output[m.player_white][1] += 1
                output[m.player_black][1] += 1
            case Result.BLACK_WIN:
                output[m.player_white][2] += 1
                output[m.player_black][0] += 1
    return output


def calculate_ranking(matches: list[Match]) -> list[SimkroRank]:
    games_played = calculate_games_played(matches)
    saldo = calculate_saldo(matches)
    points = calculate_point_total(matches)
    color_saldo = calculate_color_saldo(matches)
    win_draw_loss = calculate_win_draw_loss(matches)
    ranking = []
    for idx, (player, points) in enumerate(
        sorted(points.items(), key=lambda x: (-x[1], x[0].name))
    ):
        ranking.append(
            SimkroRank(
                position=idx + 1,
                player=player,
                games_played=games_played[player],
                saldo=saldo[player],
                points=points,
                color_saldo=color_saldo[player],
                wins=win_draw_loss[player][0],
                draws=win_draw_loss[player][1],
                losses=win_draw_loss[player][2],
            )
        )
    return ranking
