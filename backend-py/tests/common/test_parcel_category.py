from app.common.parcel_generation.parcel_category import category_for


def test_no_restriction_no_dispute_is_none():
    assert category_for(None, None) == "NONE"


def test_restricted_status_wins_when_no_active_dispute():
    assert category_for("RESTRICTED", None) == "RESTRICTED"
    assert category_for("RESTRICTED", {"hasActiveDispute": False, "disputeType": "OWNERSHIP"}) == "RESTRICTED"


def test_active_dispute_takes_priority_over_restriction():
    dispute = {"hasActiveDispute": True, "disputeType": "BOUNDARY"}
    assert category_for("RESTRICTED", dispute) == "DISPUTE_BOUNDARY"


def test_every_dispute_type_maps_to_its_own_category():
    for dispute_type, expected in [
        ("OWNERSHIP", "DISPUTE_OWNERSHIP"),
        ("BOUNDARY", "DISPUTE_BOUNDARY"),
        ("INHERITANCE", "DISPUTE_INHERITANCE"),
        ("ENCROACHMENT", "DISPUTE_ENCROACHMENT"),
    ]:
        dispute = {"hasActiveDispute": True, "disputeType": dispute_type}
        assert category_for(None, dispute) == expected


def test_unknown_dispute_type_falls_back_to_restriction_then_none():
    dispute = {"hasActiveDispute": True, "disputeType": "SOMETHING_ELSE"}
    assert category_for(None, dispute) == "NONE"
    assert category_for("RESTRICTED", dispute) == "RESTRICTED"
