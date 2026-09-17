from app.database import SessionLocal
from app.models.governance import GovernanceRule
import json

db = SessionLocal()
try:
    # Check if rules exist
    rules = db.query(GovernanceRule).all()
    print(f'Existing rules: {len(rules)}')
    for r in rules:
        print(f'  {r.alert_type}: {r.name}')
    
    # Add default rules if missing
    default_rules = [
        {
            'alert_type': 'RESTRICTION_ZONE_OVERLAP',
            'name': 'Restriction Zone Overlap',
            'description': 'Parcel overlaps with a restriction zone (flood, environmental, protected area)',
            'condition_config': json.dumps({'intersects': True}),
            'default_severity': 'HIGH',
            'explanation_template': 'Parcel overlaps with restriction zone',
            'is_active': True,
            'department': 'LAND_RECORDS',
        },
        {
            'alert_type': 'UNAUTHORIZED_CHANGE_DETECTED',
            'name': 'Unauthorized Change Detected',
            'description': 'Change detection found modifications not matching any approved workflow',
            'condition_config': json.dumps({'min_pixel_ratio': 0.01}),
            'default_severity': 'MEDIUM',
            'explanation_template': 'Unauthorized change of {changed_pixel_ratio}% detected',
            'is_active': True,
            'department': 'LAND_RECORDS',
        },
        {
            'alert_type': 'TAX_OVERDUE',
            'name': 'Property Tax Overdue',
            'description': 'Property tax payments are overdue beyond threshold',
            'condition_config': json.dumps({'min_overdue_amount': 100}),
            'default_severity': 'MEDIUM',
            'explanation_template': 'Tax overdue by {overdue_amount}',
            'is_active': True,
            'department': 'TAX',
        },
        {
            'alert_type': 'RESTRICTION_DETECTED',
            'name': 'Restriction Detected via Historical Imagery',
            'description': 'Parcel falls within designated flood risk zone via historical comparison',
            'condition_config': json.dumps({
                'categories': ['RESTRICTED'],
                'severity_by_category': {'RESTRICTED': 'MEDIUM'}
            }),
            'default_severity': 'HIGH',
            'explanation_template': 'Parcel in restricted zone',
            'is_active': True,
            'department': 'PLANNING',
        },
        {
            'alert_type': 'DISPUTE_DETECTED',
            'name': 'Dispute Detected via Historical Imagery',
            'description': 'Parcel shows signs of potential dispute based on category change',
            'condition_config': json.dumps({
                'categories': ['DISPUTE_OWNERSHIP', 'DISPUTE_BOUNDARY', 'DISPUTE_INHERITANCE', 'DISPUTE_ENCROACHMENT'],
                'severity_by_category': {
                    'DISPUTE_ENCROACHMENT': 'CRITICAL',
                    'DISPUTE_BOUNDARY': 'HIGH',
                    'DISPUTE_OWNERSHIP': 'HIGH',
                    'DISPUTE_INHERITANCE': 'MEDIUM'
                }
            }),
            'default_severity': 'HIGH',
            'explanation_template': 'Potential dispute detected: {to_category}',
            'is_active': True,
            'department': 'LAND_RECORDS',
        },
    ]
    
    for rule_data in default_rules:
        existing = db.query(GovernanceRule).filter(GovernanceRule.alert_type == rule_data['alert_type']).first()
        if not existing:
            rule = GovernanceRule(**rule_data)
            db.add(rule)
            print(f'Added: {rule_data["alert_type"]}')
        else:
            # Update condition_config if it differs
            import json
            existing_config = json.loads(existing.condition_config)
            new_config = json.loads(rule_data['condition_config'])
            if existing_config != new_config:
                existing.condition_config = rule_data['condition_config']
                print(f'Updated condition: {rule_data["alert_type"]}')
            else:
                # Also check default_severity
                if existing.default_severity != rule_data['default_severity']:
                    existing.default_severity = rule_data['default_severity']
                    print(f'Updated severity: {rule_data["alert_type"]} -> {rule_data["default_severity"]}')
                else:
                    print(f'Exists: {rule_data["alert_type"]}')
    
    db.commit()
    print('Done!')
finally:
    db.close()