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
- turnus: A set of rounds in which two opponents can only be paired once. The
competition lasts 30 rounds and rounds 1-10, 11-20 and 21-30 form a turnus. So two
players can be paired a maximum of three times against each other, once in rounds 1-10,
once in rounds 11-20, once in rounds 21-30.
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
If the two opponents already played against each other in the same turnus, they can not
be paired again.

Pairing
-------
The pairng of players in a round of a SimKro competition goes in the following steps:

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

from collections import defaultdict
import itertools

from backend.models import Match, Player, Result

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
# Number of games a player needs to have played before being able to play an opponent
# again without a penalty.
N_GAMES_BETWEEN = 4
# The weight given to the color and point part of the penalty score.
PENALTY_COLOR_WEIGHT = 0.5
PENALTY_POINT_WEIGHT = 0.001


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
    """Get the pairs of players that played already in the turnus of the given round.

    Parameters
    ----------
    matches : list[Match]
        List of matches.
    round_nr : int
        Number of the round.

    Returns
    -------
    set[frozenset[Player]]
        Set of pairs {player1, player2} of players that played a match in the turnus to
        which the input round belongs.
    """
    # Round nr starts counting from 1, not 0.
    turnus_start = N_ROUNDS_TURNUS * ((round_nr - 1) // N_ROUNDS_TURNUS) + 1
    turnus_matches = [
        m
        for m in matches
        if m.round in range(turnus_start, turnus_start + N_ROUNDS_TURNUS)
    ]
    # We use frozenset to represent a symmetric pair.
    return {frozenset((m.player_white, m.player_black)) for m in turnus_matches}


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
        # We don't need to look further than `N_GAMES_BETWEE` games in the past.
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
                m.player_white
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
