import abc


class BaseRating(abc.ABC):
    def __init__(self, sequential: bool = False):
        """The base class of a rating.

        Parameters
        ----------
        sequential : bool, optional
            When given a list of opponent ratings and results, should the rating of the
            player be calculated and updated after each individual result, or should the
            starting rating of the player be used for all calculations?
        """
        self.sequential = sequential

    @abc.abstractmethod
    def expected_score(self, player_rating: float, opponent_rating: float) -> float:
        """The score the player is expected to get against this opponent.

        This is the expectancy model shared by the rating change and the performance
        rating. Implementations must be non-decreasing in `player_rating`;
        `performance_rating` inverts this function by bisection and relies on it.

        Parameters
        ----------
        player_rating : float
            Rating of the player.
        opponent_rating : float
            Rating of the opponent.

        Returns
        -------
        float
            Expected score for the player, between 0 and 1. 0.5 means an even game.
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def calculate_change(
        self, player_rating: float, opponent_rating: float | None, score: float
    ) -> float:
        """Calculate the change in rating of a player based on a single result.

        The algorithm should be able to handle opponents without rating.

        Parameters
        ----------
        player_rating : float
            Rating of the player for which the rating change should be calculated.
        opponent_rating : float | None
            Rating of the opponent or None if the opponent has no rating.
        score : float
            The score for the player (i.e. 0, 1 or 0.5).

        Returns
        -------
        float
            Change of rating for the player based on the result.
        """
        raise NotImplementedError()

    def calculate_change_list(
        self,
        player_rating: float,
        opponent_ratings: list[float | None],
        scores: list[float],
    ) -> float:
        """Calculate the change in rating of a player based on a list of results.

        Parameters
        ----------
        player_rating : float
            Rating of the player for which the rating change should be calculated.
        opponent_ratings : list[float | None]
            List of ratings of the opponents, `None` for an opponent without a rating.
            Should be the same size as `scores`.
        scores : list[float]
            The scores for the player (i.e. 0, 1 or 0.5). Should be the same size as
            `opponent_ratings`.

        Returns
        -------
        float
            Change of rating for the player based on the list of results.

        Examples
        --------
        >>> class DiffRating(BaseRating):
        ...     def expected_score(self, player_rating, opponent_rating):
        ...         return 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))
        ...     def calculate_change(self, player_rating, opponent_rating, score):
        ...         return score * (opponent_rating - player_rating)
        >>> r = DiffRating(sequential=False)
        >>> r.calculate_change_list(2000, [2100, 2100], [1, 1])
        200
        >>> r.sequential = True
        >>> r.calculate_change_list(2000, [2100, 2100], [1, 1])
        100
        """
        if len(opponent_ratings) != len(scores):
            raise ValueError(
                "number of opponent ratings should be equal to number of scores."
            )
        if len(opponent_ratings) == 0:
            return 0

        rating_change = 0
        for opponent_rating, score in zip(opponent_ratings, scores, strict=True):
            rating = player_rating
            if self.sequential:
                rating += rating_change
            rating_change += self.calculate_change(rating, opponent_rating, score)
        return rating_change

    def performance_rating(
        self, opponent_ratings: list[float | None], scores: list[float]
    ) -> float:
        """The rating at which these results would have been exactly the expected outcome.

        The performance rating is the rating `Rp` for which
        `sum(expected_score(Rp, opponent)) == sum(scores)`. It is found by bisection, so
        it is the exact inverse of `expected_score` rather than a table lookup.

        Opponents without a rating are dropped: there is no well-defined expectancy
        against an unknown strength.

        Parameters
        ----------
        opponent_ratings : list[float | None]
            List of ratings of the opponents, `None` for an opponent without a rating.
            Should be the same size as `scores`.
        scores : list[float]
            The scores for the player (i.e. 0, 1 or 0.5). Should be the same size as
            `opponent_ratings`.

        Returns
        -------
        float
            The performance rating over these results.

        Raises
        ------
        ValueError
            If the two lists differ in length, or if no opponent counts (an empty list,
            or every opponent unrated). Note that an empty list raises here while
            `calculate_change_list` returns 0: a change of nothing is zero, but a
            performance rating over nothing is undefined.

        Notes
        -----
        Theoretically a score of 0% or 100% would give a performance rating of minus or
        plus infinity. What this algorithm does instead is limit the performance rating
        to [Ra-800,Ra+800]. This value of 800 is somewhat arbitrary but matches what
        FIDE does in their performance rating calculations.
        """
        if len(opponent_ratings) != len(scores):
            raise ValueError(
                "number of opponent ratings should be equal to number of scores."
            )
        counted = [
            (opponent_rating, score)
            for opponent_rating, score in zip(opponent_ratings, scores, strict=True)
            if opponent_rating is not None
        ]
        if not counted:
            raise ValueError("a performance rating needs at least one rated opponent.")

        total_score = sum(score for _, score in counted)
        average_rating = sum(rating for rating, _ in counted) / len(counted)

        low, high = average_rating - 800, average_rating + 800
        # 30 halvings of a 1600 point bracket is far below any meaningful precision.
        for _ in range(30):
            middle = (low + high) / 2
            expected = sum(self.expected_score(middle, rating) for rating, _ in counted)
            if expected < total_score:
                low = middle
            else:
                high = middle
        return (low + high) / 2
