import { useTranslation } from "react-i18next";
import { components } from "@client/schema";
import EditableTable from "@/table/EditableTable";
import {
  createEditableRatingCell,
  readOnlyRatingCell,
  playerCell,
} from "./cells";
import { usePlayerRatings } from "./usePlayerRatings";

type CompetitionRatingPublic = components["schemas"]["CompetitionRatingPublic"];

/**
 * Every player in the competition with the rating they entered it with.
 */
export default function PlayerRatingTable({
  competitionName,
  readOnly = false,
}: {
  competitionName: string;
  /** View-only, even for a moderator: the competition is finished. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const queryResult = usePlayerRatings(competitionName);
  const initialRatingLabel = t("player.initialRating");

  const validateData = (rating: CompetitionRatingPublic) => {
    const errors: Partial<Record<keyof CompetitionRatingPublic, string>> = {};
    if (rating.initial_rating !== null && rating.initial_rating < 0) {
      errors.initial_rating = t("rating.mustNotBeNegative");
    }
    return errors;
  };

  return (
    <EditableTable<CompetitionRatingPublic>
      queryResult={queryResult}
      entityType="rating"
      title={t("rating.playerRatingsTitle")}
      columns={[
        // The endpoint is keyed by player, not by rating row.
        { field: "player_id", isId: true, hidden: true },
        {
          field: "player",
          cell: playerCell,
          header: t("registration.player"),
          href: (row) => `/players/${row.player_id}`,
        },
        {
          field: "initial_rating",
          cell: createEditableRatingCell(initialRatingLabel),
          header: initialRatingLabel,
          isEditable: true,
          width: 160,
        },
        {
          field: "current_rating",
          cell: readOnlyRatingCell,
          header: t("player.currentRating"),
          width: 160,
        },
      ]}
      sort={(a, b) => a.player.name.localeCompare(b.player.name)}
      editConfig={{
        validateData,
        sanitizeData: (rating) => rating,
        getRequestBody: (rating) => ({ initial_rating: rating.initial_rating }),
      }}
      readOnly={readOnly}
    />
  );
}
