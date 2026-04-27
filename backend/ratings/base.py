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
    def calculate_change(
        self, player_rating: float, opponent_rating: float, score: float
    ) -> float:
        """Calculate the change in rating of a player based on a single result.

        Parameters
        ----------
        player_rating : float
            Rating of the player for which the rating change should be calculated.
        opponent_rating : float
            Rating of the opponent.
        score : float
            The score for the player (i.e. 0, 1 or 0.5).

        Returns
        -------
        float
            Change of rating for the player based on the result.
        """
        raise NotImplementedError()

    def calculate_change_list(
        self, player_rating: float, opponent_ratings: list[float], scores: list[float]
    ) -> float:
        """Calculate the change in rating of a player based on a list of results.

        Parameters
        ----------
        player_rating : float
            Rating of the player for which the rating change should be calculated.
        opponent_ratings : list[float]
            List of ratings of the opponents. Should be the same size as `scores`.
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
