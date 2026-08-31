"""Competition types

This module contains the competitions types that are availale in the application. A
competition consists of multiple rounds, each round containing a number of matches. The
competition type determines:
- Which players will play in a specific round?
    For a Simkro competition players need to register for each individual round. For a
    round robin the list of players of each round is determined before the start of the
    first round.
- Given the players and the results of the previous rounds, what are the pairings for
the next round?
    For a Simkro competition there is a specific algorithm to create the pairings. For a
    round robin the pairings a fixed based on the starting numbers of the players.
- Given the match results up the a specific round, what is the ranking after that round?
    For a Simkro competition this is determined by a specific algorithm that uses
    multiple inputs such as the player score, the number of games played and the results
    of the opponents. For a round robin this is determined by the number of points the
    player scored.
- What algorithm is used to calculate ratings for the competition?
    See the ratings module for the available algorithms. The current rating of a player
    in a competition can always be determined by the algorithm, the initial rating of
    the player in the competition and the match results of the player. For Simkro the
    algorithm is a basic ELO algorithm and the initial rating can be manual, a default
    value or based on an external rating snapshot.

Currently only the Simkro type is available, but more types might be added in the
future.
"""

import enum


class CompetitionType(str, enum.Enum):
    SIMKRO = "simkro"
