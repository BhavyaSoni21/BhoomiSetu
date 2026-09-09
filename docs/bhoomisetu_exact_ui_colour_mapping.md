# BhoomiSetu — Exact UI Colour Mapping
## Light + Dark Mode

**Deployed website:** https://bhoomi-setu-nine.vercel.app/  
**Design direction:** Land + GIS + Agriculture + Trust + Governance + Technology

> This file assigns a specific colour to each UI role so the interface does not become an uncontrolled mixture of greens and browns.
>
> The core rule is:
>
> **Green = brand / action / verified**
>
> **Brown = land / soil / property accent**
>
> **Warm white = primary light-mode environment**
>
> **Dark forest = primary dark-mode environment**
>
> **Red / amber / blue = status only**

---

# 1. Master Design Tokens

## Light Mode

```text
Page background       #F7FAF5
Primary surface       #FFFFFF
Secondary surface     #F1F5EF
Green surface         #ECFDF5
Earth surface         #FBF4EA

Primary heading       #0F3D2E
Primary text          #34413A
Secondary text        #53635A
Muted text            #718078
Disabled text         #A0AAA4

Primary green         #166534
Action green          #15803D
Bright green          #22C55E
Light green           #86EFAC

Earth brown           #92400E
Deep earth            #78350F
Sand                  #D6A46F

Border                #DDE5DF
Strong border         #C6D4CA

Focus                 #22C55E
Link                  #15803D
```

## Dark Mode

```text
Page background       #071A14
Primary surface       #0D261D
Secondary surface     #123126
Green surface         #123A2A
Earth surface         #332418

Primary heading       #F0FDF4
Primary text          #DCEBE2
Secondary text        #B9CCC1
Muted text            #91A39A
Disabled text         #65756D

Primary green         #4ADE80
Action green          #34D399
Bright green          #86EFAC
Light green           #BBF7D0

Earth brown           #D6A46F
Deep earth            #B9824E
Sand                  #E7C79E

Border                #244438
Strong border         #35584A

Focus                 #4ADE80
Link                  #86EFAC
```

---

# 2. Global Body

## Light

```text
<body>
background: #F7FAF5
color: #34413A
```

## Dark

```text
<body>
background: #071A14
color: #DCEBE2
```

### Rule

Never use `#FFFFFF` as the entire dark-mode page.

Never use `#0F3D2E` as the background of every light-mode section.

---

# 3. Top Navigation / Navbar

## Light Navbar

```text
Background        #0F3D2E
Primary text      #FFFFFF
Secondary text    #D7EEE0
Icon              #D7EEE0
Icon hover        #86EFAC
Active text       #FFFFFF
Active background #14532D
Active indicator  #22C55E
Border            rgba(255,255,255,0.10)
```

## Dark Navbar

```text
Background        #06150F
Primary text      #F0FDF4
Secondary text    #B9CCC1
Icon              #B9CCC1
Icon hover        #86EFAC
Active text       #FFFFFF
Active background #123A2A
Active indicator  #4ADE80
Border            #1E382E
```

### Navbar rule

The navbar should remain dark in both modes.

Do **not** change the navbar to bright green.

---

# 4. Logo / Brand Name

```text
Logo icon light mode: #22C55E
Logo icon dark mode:  #86EFAC

Logo text light mode: #FFFFFF
Logo text dark mode:  #F0FDF4

Optional earth detail:
#D6A46F
```

Use brown only for a tiny secondary logo detail, not the complete logo.

---

# 5. Sidebar

## Light

```text
Background       #FFFFFF
Border           #DDE5DF
Primary text     #34413A
Muted text       #718078
Icon             #66736B

Hover background #F1F8F3
Hover text       #166534

Active background #E5F5EA
Active text       #0F3D2E
Active icon       #15803D
Active indicator  #22C55E
```

## Dark

```text
Background       #0D261D
Border           #244438
Primary text     #DCEBE2
Muted text       #91A39A
Icon             #91A39A

Hover background #123A2A
Hover text       #86EFAC

Active background #153D2C
Active text       #F0FDF4
Active icon       #4ADE80
Active indicator  #4ADE80
```

---

# 6. Main Content Area

## Light

```text
background: #F7FAF5
```

## Dark

```text
background: #071A14
```

The main content must always provide visible separation from cards.

---

# 7. Section Backgrounds

## Light

```text
Default section     #F7FAF5
Soft section        #F1F5EF
Green section       #ECFDF5
Warm land section   #FBF4EA
Neutral section     #F8FAF9
```

## Dark

```text
Default section     #071A14
Soft section        #0D261D
Green section       #123A2A
Warm land section   #332418
Neutral section     #0A211A
```

---

# 8. H1

## Light

```text
#0F3D2E
```

## Dark

```text
#F0FDF4
```

Use the deepest green for light mode.

Do not use brown for H1.

---

# 9. H2

## Light

```text
#14532D
```

## Dark

```text
#DCFCE7
```

---

# 10. H3

## Light

```text
#166534
```

## Dark

```text
#BBF7D0
```

---

# 11. H4 / H5 / H6

## Light

```text
#34413A
```

## Dark

```text
#DCEBE2
```

---

# 12. Body Text

## Primary

```text
Light #34413A
Dark  #DCEBE2
```

## Secondary

```text
Light #53635A
Dark  #B9CCC1
```

## Muted

```text
Light #718078
Dark  #91A39A
```

## Disabled

```text
Light #A0AAA4
Dark  #65756D
```

---

# 13. Links

## Normal

```text
Light #15803D
Dark  #86EFAC
```

## Hover

```text
Light #0F5F2E
Dark  #BBF7D0
```

## Visited

Do not introduce purple.

```text
Light #166534
Dark  #A7F3D0
```

---

# 14. Primary Button

Use for important product actions.

Examples:

- Add
- Save
- Submit
- Verify
- Approve
- Continue
- Generate

## Light

```text
Background #15803D
Text       #FFFFFF
Border     #15803D

Hover      #166534
Pressed    #14532D
```

## Dark

```text
Background #34D399
Text       #06251A
Border     #34D399

Hover      #4ADE80
Pressed    #22C55E
```

---

# 15. Bright CTA Button

Use only for the strongest CTA on a page.

## Light

```text
Background #22C55E
Text       #052E22
Hover      #16A34A
Pressed    #15803D
```

## Dark

```text
Background #86EFAC
Text       #06251A
Hover      #4ADE80
Pressed    #34D399
```

Do not use bright CTA green on every button.

---

# 16. Secondary Button

## Light

```text
Background #FFFFFF
Text       #166534
Border     #9DCBAA

Hover bg   #ECFDF5
Hover text #0F3D2E
```

## Dark

```text
Background #0D261D
Text       #BBF7D0
Border     #35584A

Hover bg   #153D2C
Hover text #F0FDF4
```

---

# 17. Earth / Land Button

Use for property or land-specific secondary actions.

Examples:

- View Land
- Survey
- Property Details
- Land Documents
- Boundary

## Light

```text
Background #92400E
Text       #FFFFFF
Hover      #78350F
Pressed    #5C2F16
```

## Dark

```text
Background #B9824E
Text       #1E140C
Hover      #D6A46F
Pressed    #C99B63
```

Brown must remain secondary to green.

---

# 18. Ghost Button

## Light

```text
Background transparent
Text       #166534
Hover bg   #ECFDF5
Active bg  #DCFCE7
```

## Dark

```text
Background transparent
Text       #86EFAC
Hover bg   #123A2A
Active bg  #153D2C
```

---

# 19. Danger Button

## Light

```text
Background #DC2626
Text       #FFFFFF
Hover      #B91C1C
Pressed    #991B1B
```

## Dark

```text
Background #EF4444
Text       #260707
Hover      #F87171
Pressed    #DC2626
```

Only for destructive operations.

---

# 20. Input Fields

## Light

```text
Background      #FFFFFF
Text            #24342B
Placeholder     #8A9890
Border          #C9D6CE
Hover border    #8FBBA0

Focus border    #22C55E
Focus ring      rgba(34,197,94,0.18)
```

## Dark

```text
Background      #0D261D
Text            #E8F4ED
Placeholder     #80938A
Border          #35584A
Hover border    #4A6E5E

Focus border    #4ADE80
Focus ring      rgba(74,222,128,0.18)
```

---

# 21. Select / Dropdown

## Light

```text
Background #FFFFFF
Text       #34413A
Border     #C9D6CE

Hover      #F1F8F3
Selected   #E5F5EA
Selected text #0F3D2E
```

## Dark

```text
Background #0D261D
Text       #DCEBE2
Border     #35584A

Hover      #123A2A
Selected   #153D2C
Selected text #F0FDF4
```

---

# 22. Search Box

## Light

```text
Background #FFFFFF
Text       #34413A
Placeholder #819087
Icon       #66736B
Border     #D6E0D9
Focus      #22C55E
```

## Dark

```text
Background #0D261D
Text       #DCEBE2
Placeholder #80938A
Icon       #91A39A
Border     #2C4B3E
Focus      #4ADE80
```

---

# 23. Cards

## Light

```text
Background #FFFFFF
Border     #DDE5DF
Heading    #0F3D2E
Body       #53635A
Muted      #718078
```

## Dark

```text
Background #0D261D
Border     #244438
Heading    #F0FDF4
Body       #B9CCC1
Muted      #91A39A
```

---

# 24. Green Card

## Light

```text
Background #ECFDF5
Border     #BFE7CA
Heading    #0F3D2E
Icon       #15803D
```

## Dark

```text
Background #123A2A
Border     #2D6149
Heading    #F0FDF4
Icon       #4ADE80
```

---

# 25. Earth Card

## Light

```text
Background #FBF4EA
Border     #E7CBA9
Heading    #78350F
Icon       #92400E
```

## Dark

```text
Background #332418
Border     #60432D
Heading    #F3D7B4
Icon       #D6A46F
```

---

# 26. KPI Cards

## Success KPI

### Light

```text
Background #ECFDF5
Border     #BFE7CA
Value      #0F3D2E
Label      #53635A
Icon bg    #D9FBE4
Icon       #15803D
```

### Dark

```text
Background #123A2A
Border     #2D6149
Value      #F0FDF4
Label      #B9CCC1
Icon bg    #1B4C35
Icon       #4ADE80
```

---

# 27. Warning KPI

## Light

```text
Background #FFFBEB
Border     #F6D58A
Value      #78350F
Label      #6B6255
Icon       #D97706
```

## Dark

```text
Background #332B17
Border     #6B5724
Value      #FDE68A
Label      #D6C9A1
Icon       #FBBF24
```

---

# 28. Critical KPI

## Light

```text
Background #FEF2F2
Border     #F3B5B5
Value      #991B1B
Label      #705A5A
Icon       #DC2626
```

## Dark

```text
Background #351819
Border     #6A2E30
Value      #FECACA
Label      #D4AAAA
Icon       #F87171
```

---

# 29. Information KPI

## Light

```text
Background #ECFEFF
Border     #A8E5E8
Value      #115E59
Label      #526D6D
Icon       #0F766E
```

## Dark

```text
Background #103333
Border     #255C5D
Value      #CCFBF1
Label      #A6C7C5
Icon       #2DD4BF
```

---

# 30. Tables

## Light

```text
Table background #FFFFFF
Header background #EEF4EF
Header text       #365146
Body text         #34413A
Border            #E5ECE7
Row hover         #F3FAF5
Selected row      #E8F6EC
```

## Dark

```text
Table background #0D261D
Header background #123126
Header text       #CFE2D7
Body text         #DCEBE2
Border            #244438
Row hover         #123A2A
Selected row      #153D2C
```

Avoid heavy zebra striping in both modes.

---

# 31. Tabs

## Light

```text
Inactive text       #718078
Hover text          #166534
Active text         #0F3D2E
Active underline    #22C55E
```

## Dark

```text
Inactive text       #91A39A
Hover text          #BBF7D0
Active text         #F0FDF4
Active underline    #4ADE80
```

---

# 32. Breadcrumbs

## Light

```text
Inactive #718078
Separator #A5B0AA
Current #0F3D2E
```

## Dark

```text
Inactive #91A39A
Separator #65756D
Current #F0FDF4
```

---

# 33. Pagination

## Light

```text
Normal background #FFFFFF
Normal text       #53635A
Border            #DDE5DF

Hover bg          #ECFDF5
Hover text        #166534

Active bg         #166534
Active text       #FFFFFF
```

## Dark

```text
Normal background #0D261D
Normal text       #B9CCC1
Border            #244438

Hover bg          #123A2A
Hover text        #BBF7D0

Active bg         #34D399
Active text       #06251A
```

---

# 34. Badges / Status

## Verified

Light:

```text
bg #DCFCE7
text #166534
border #BBE8C7
```

Dark:

```text
bg #173F2B
text #BBF7D0
border #2D6149
```

## Active

Light:

```text
bg #E7F7EC
text #15803D
border #B8DEC2
```

Dark:

```text
bg #153D2C
text #86EFAC
border #2D6149
```

## Pending

Light:

```text
bg #FEF3C7
text #92400E
border #F6D58A
```

Dark:

```text
bg #332B17
text #FDE68A
border #6B5724
```

## Under Review

Light:

```text
bg #EFF6FF
text #1D4ED8
border #BFDBFE
```

Dark:

```text
bg #172A45
text #93C5FD
border #29476D
```

## Draft

Light:

```text
bg #F1F5F3
text #66736B
border #D6DFD9
```

Dark:

```text
bg #17231F
text #91A39A
border #33463D
```

## Disputed

Light:

```text
bg #FEE2E2
text #991B1B
border #F3B5B5
```

Dark:

```text
bg #351819
text #FECACA
border #6A2E30
```

---

# 35. Alerts

## Success

Light:

```text
bg #ECFDF5
border #BFE7CA
icon #15803D
title #166534
body #3E6250
```

Dark:

```text
bg #123A2A
border #2D6149
icon #4ADE80
title #BBF7D0
body #B9CCC1
```

## Warning

Light:

```text
bg #FFFBEB
border #F6D58A
icon #D97706
title #92400E
body #6B6255
```

Dark:

```text
bg #332B17
border #6B5724
icon #FBBF24
title #FDE68A
body #D6C9A1
```

## Error

Light:

```text
bg #FEF2F2
border #F3B5B5
icon #DC2626
title #991B1B
body #705A5A
```

Dark:

```text
bg #351819
border #6A2E30
icon #F87171
title #FECACA
body #D4AAAA
```

---

# 36. Toast Notifications

## Success

```text
Light bg #166534
Light text #FFFFFF

Dark bg #34D399
Dark text #06251A
```

## Warning

```text
Light bg #92400E
Light text #FFFFFF

Dark bg #D6A46F
Dark text #21140B
```

## Error

```text
Light bg #B91C1C
Light text #FFFFFF

Dark bg #EF4444
Dark text #250707
```

---

# 37. Modals

## Light

```text
Overlay:
rgba(5,46,34,0.44)

Modal background:
#FFFFFF

Modal border:
#DDE5DF

Modal heading:
#0F3D2E

Modal body:
#53635A

Footer background:
#F7FAF5
```

## Dark

```text
Overlay:
rgba(0,0,0,0.62)

Modal background:
#0D261D

Modal border:
#35584A

Modal heading:
#F0FDF4

Modal body:
#B9CCC1

Footer background:
#071A14
```

---

# 38. Dropdown Menus

## Light

```text
Background #FFFFFF
Border #DDE5DF
Text #34413A
Hover #F1F8F3
Selected #E5F5EA
```

## Dark

```text
Background #0D261D
Border #35584A
Text #DCEBE2
Hover #123A2A
Selected #153D2C
```

---

# 39. Tooltips

## Both modes

Keep tooltip dark for maximum consistency.

```text
Background #17362A
Text       #FFFFFF
Border     #2D5142
```

---

# 40. Empty States

## Light

```text
Container background #F7FAF5
Icon background      #ECFDF5
Icon                 #15803D
Heading              #0F3D2E
Body                 #718078
CTA                  #15803D
```

## Dark

```text
Container background #071A14
Icon background      #123A2A
Icon                 #4ADE80
Heading              #F0FDF4
Body                 #91A39A
CTA                  #34D399
```

---

# 41. Loading States / Skeleton

## Light

```text
Skeleton base:
#E8EFEA

Skeleton highlight:
#F7FAF5
```

## Dark

```text
Skeleton base:
#17372B

Skeleton highlight:
#214A3A
```

Do not use bright green for skeleton loaders.

---

# 42. Checkboxes

## Light

```text
Unchecked border #A9B9AF
Checked bg       #15803D
Checked icon     #FFFFFF
Hover border     #22C55E
```

## Dark

```text
Unchecked border #527163
Checked bg       #34D399
Checked icon     #06251A
Hover border     #4ADE80
```

---

# 43. Radio Buttons

Use the same visual logic as checkboxes.

## Light

```text
Outer #A9B9AF
Selected #15803D
Focus #22C55E
```

## Dark

```text
Outer #527163
Selected #34D399
Focus #4ADE80
```

---

# 44. Toggle / Switch

## Off

Light:

```text
Track #D6DFD9
Knob #FFFFFF
```

Dark:

```text
Track #33463D
Knob #DCEBE2
```

## On

Light:

```text
Track #15803D
Knob #FFFFFF
```

Dark:

```text
Track #34D399
Knob #06251A
```

---

# 45. Progress Bars

## Standard

Light:

```text
Track #DDE8DF
Fill #15803D
```

Dark:

```text
Track #244438
Fill #34D399
```

## Excellent / Complete

Light:

```text
Fill #22C55E
```

Dark:

```text
Fill #86EFAC
```

---

# 46. GIS / Land Map

Do not make the map a rainbow.

Use a controlled five-state system.

## Verified Land

Light:

```text
Fill #22C55E
Fill opacity 28%
Border #15803D
```

Dark:

```text
Fill #4ADE80
Fill opacity 22%
Border #34D399
```

## Selected Parcel

Light:

```text
Fill #166534
Fill opacity 45%
Border #0F3D2E
```

Dark:

```text
Fill #86EFAC
Fill opacity 28%
Border #BBF7D0
```

## Pending Verification

Light:

```text
Fill #F59E0B
Fill opacity 28%
Border #B45309
```

Dark:

```text
Fill #FBBF24
Fill opacity 24%
Border #D97706
```

## Disputed

Light:

```text
Fill #DC2626
Fill opacity 22%
Border #991B1B
```

Dark:

```text
Fill #F87171
Fill opacity 20%
Border #EF4444
```

## High Risk

Light:

```text
Fill #F97316
Fill opacity 24%
Border #C2410C
```

Dark:

```text
Fill #FB923C
Fill opacity 20%
Border #EA580C
```

## Project Boundary

Both:

```text
Colour #78350F
Opacity 85%
```

Dark-mode alternative:

```text
#D6A46F
```

## Field Survey Track

Light:

```text
#0F766E
```

Dark:

```text
#2DD4BF
```

---

# 47. GIS Map Background

Do not colour the actual map with the UI brand greens.

For UI around the map:

## Light

```text
Map panel #FFFFFF
Map controls #FFFFFF
Map control border #DDE5DF
Map labels #34413A
```

## Dark

```text
Map panel #0D261D
Map controls #0D261D
Map control border #35584A
Map labels #DCEBE2
```

The underlying geographic basemap should remain visually neutral.

---

# 48. GIS Legend

## Light

```text
Background #FFFFFF
Border #DDE5DF
Heading #0F3D2E
Text #53635A
```

## Dark

```text
Background #0D261D
Border #35584A
Heading #F0FDF4
Text #B9CCC1
```

Legend colours:

```text
Verified       #22C55E
Pending        #F59E0B
Disputed       #DC2626
High Risk      #F97316
Selected       #166534
Boundary       #78350F
```

---

# 49. Charts

Recommended chart palette:

```text
Series 1  #15803D
Series 2  #22C55E
Series 3  #A7C957
Series 4  #D6A46F
Series 5  #0F766E
Series 6  #64748B
```

Dark-mode chart replacements:

```text
Series 1  #34D399
Series 2  #86EFAC
Series 3  #A7F3D0
Series 4  #D6A46F
Series 5  #2DD4BF
Series 6  #94A3B8
```

Never use:

```text
random neon purple
random hot pink
random cyan
random gradient per chart
```

unless a specific status requires them.

---

# 50. Chart Grid / Axes

## Light

```text
Grid #E5ECE7
Axis #A5B0AA
Labels #66736B
Title #0F3D2E
```

## Dark

```text
Grid #1E382E
Axis #527163
Labels #91A39A
Title #F0FDF4
```

---

# 51. Footer

## Light

```text
Background #0F3D2E
Primary text #FFFFFF
Secondary text #D7EEE0
Links #86EFAC
Border rgba(255,255,255,0.10)
```

## Dark

```text
Background #06150F
Primary text #F0FDF4
Secondary text #B9CCC1
Links #86EFAC
Border #1E382E
```

---

# 52. Login / Authentication

## Light

```text
Page bg      #F7FAF5
Card         #FFFFFF
Logo         #0F3D2E
Heading      #0F3D2E
Body         #53635A
Input        #FFFFFF
Input border #C9D6CE
Focus        #22C55E
Primary btn  #15803D
Secondary    #F3E8D3
Secondary text #78350F
```

## Dark

```text
Page bg      #071A14
Card         #0D261D
Logo         #86EFAC
Heading      #F0FDF4
Body         #B9CCC1
Input        #0D261D
Input border #35584A
Focus        #4ADE80
Primary btn  #34D399
Secondary    #332418
Secondary text #D6A46F
```

---

# 53. Landing Page Hero

## Light hero

```text
Background:
#0F3D2E

H1:
#FFFFFF

Highlight:
#86EFAC

Body:
#D7EEE0

Primary CTA:
#22C55E

CTA text:
#052E22

Secondary CTA:
transparent

Secondary border:
#86EFAC

Secondary text:
#FFFFFF
```

## Dark hero

```text
Background:
#06150F

H1:
#F0FDF4

Highlight:
#86EFAC

Body:
#B9CCC1

Primary CTA:
#86EFAC

CTA text:
#06251A

Secondary border:
#4A6E5E

Secondary text:
#F0FDF4
```

---

# 54. Earth / Agriculture Sections

Use brown in sections that specifically discuss:

- Land
- Soil
- Property
- Survey
- Agriculture
- Heritage
- Rural context

## Light

```text
Background #FBF4EA
Heading #78350F
Body #6B5A4A
Icon #92400E
Accent #D6A46F
```

## Dark

```text
Background #332418
Heading #F3D7B4
Body #D6C9B8
Icon #D6A46F
Accent #B9824E
```

---

# 55. Feature Cards

## GIS Feature

```text
Card bg     #ECFDF5
Icon        #15803D
Title       #0F3D2E
Accent      #22C55E
```

## Land Feature

```text
Card bg     #FBF4EA
Icon        #92400E
Title       #78350F
Accent      #D6A46F
```

## AI Feature

```text
Card bg     #EFF8F2
Icon        #0F766E
Title       #0F3D2E
Accent      #2DD4BF
```

## Security Feature

```text
Card bg     #F1F5F9
Icon        #475569
Title       #1F2937
Accent      #64748B
```

---

# 56. Recommended Icon Colours

Use icons according to their function.

```text
Brand / navigation       #166534
Action                   #15803D
Verified                 #16A34A
Land / property          #92400E
Agriculture              #4D7C0F
GIS / location           #0F766E
Information              #2563EB
Warning                  #D97706
Error                    #DC2626
Security                 #475569
Muted                    #718078
```

Dark mode:

```text
Brand / navigation       #86EFAC
Action                   #4ADE80
Verified                 #4ADE80
Land / property          #D6A46F
Agriculture              #A3E635
GIS / location           #2DD4BF
Information              #60A5FA
Warning                  #FBBF24
Error                    #F87171
Security                 #94A3B8
Muted                    #91A39A
```

---

# 57. Focus Ring

The focus ring must be visible in both themes.

## Light

```css
box-shadow: 0 0 0 3px rgba(34,197,94,0.18);
```

## Dark

```css
box-shadow: 0 0 0 3px rgba(74,222,128,0.20);
```

Never use a dark green focus ring on a dark surface.

---

# 58. Hover Rules

Do not change every element to bright green on hover.

Use:

```text
Text hover:
slightly deeper/lighter version

Card hover:
tiny surface shift + border shift

Button hover:
one step darker/lighter

Icon hover:
one step brighter
```

### Example

Light:

```text
Normal green  #166534
Hover         #14532D
```

Dark:

```text
Normal green  #34D399
Hover         #4ADE80
```

---

# 59. Border Rules

## Light

```text
Default border   #DDE5DF
Strong border    #C6D4CA
Green border     #BFE7CA
Earth border     #E7CBA9
```

## Dark

```text
Default border   #244438
Strong border    #35584A
Green border     #2D6149
Earth border     #60432D
```

Avoid pure black borders.

---

# 60. Shadows

## Light

```css
Small:
0 1px 3px rgba(15,61,46,0.08);

Medium:
0 8px 24px rgba(15,61,46,0.10);

Large:
0 20px 50px rgba(15,61,46,0.14);
```

## Dark

Use softer, darker shadows:

```css
Small:
0 1px 3px rgba(0,0,0,0.22);

Medium:
0 8px 24px rgba(0,0,0,0.28);

Large:
0 20px 50px rgba(0,0,0,0.36);
```

---

# 61. Gradient Rules

Only use gradients on:

- Hero
- Major banners
- Selected promotional cards
- Important visual summaries

## Green gradient

```css
linear-gradient(
  135deg,
  #0F3D2E 0%,
  #166534 58%,
  #22C55E 100%
);
```

## Green-to-earth

```css
linear-gradient(
  135deg,
  #0F3D2E 0%,
  #166534 65%,
  #92400E 100%
);
```

## Soft light background

```css
linear-gradient(
  135deg,
  #F7FAF5 0%,
  #ECFDF5 55%,
  #FBF4EA 100%
);
```

## Dark hero

```css
linear-gradient(
  135deg,
  #06150F 0%,
  #0D261D 60%,
  #332418 100%
);
```

Do not use gradients on every card and button.

---

# 62. Dark Mode Separation Rules

This is critical.

Never use:

```text
#0F3D2E text on #071A14
#166534 text on #0D261D
#22C55E text on white unless contrast is sufficient
#86EFAC text on #ECFDF5
brown text on dark brown
```

Prefer:

```text
Dark background  → light text
Dark green       → mint/near-white text
Dark earth       → sand/cream text
```

---

# 63. Light Mode Separation Rules

Never use:

```text
#86EFAC as normal body text
#BBF7D0 as normal text
#F7FAF5 as card background inside #FFFFFF without border
#D6A46F as body text
```

Prefer light greens and browns for:

- Backgrounds
- Badges
- Chips
- Highlights
- Decorative details

Use dark colours for readable text.

---

# 64. Contrast Rules

Minimum practical rules for the UI:

```text
Body text:
Use dark charcoal/green on light surfaces.

Large light text:
Only use on dark green/brown backgrounds.

Button text:
Always test against the exact button colour.

Disabled text:
Must still remain readable, but clearly inactive.

GIS fills:
Use opacity so labels remain readable.

```

Target approximately WCAG AA contrast for normal text whenever possible.

---

# 65. Full CSS Variables

```css
:root {
  /* =================================
     LIGHT MODE
     ================================= */

  --page-bg: #F7FAF5;
  --surface-1: #FFFFFF;
  --surface-2: #F1F5EF;
  --surface-green: #ECFDF5;
  --surface-earth: #FBF4EA;

  --brand-950: #052E22;
  --brand-900: #0F3D2E;
  --brand-800: #14532D;
  --brand-700: #166534;
  --brand-600: #15803D;
  --brand-500: #22C55E;
  --brand-300: #86EFAC;

  --earth-900: #5C2F16;
  --earth-800: #78350F;
  --earth-700: #92400E;
  --earth-500: #B45309;
  --earth-300: #D6A46F;
  --earth-200: #DEB887;

  --text-primary: #34413A;
  --text-heading: #0F3D2E;
  --text-secondary: #53635A;
  --text-muted: #718078;
  --text-disabled: #A0AAA4;

  --border: #DDE5DF;
  --border-strong: #C6D4CA;

  --success: #16A34A;
  --info: #0F766E;
  --warning: #D97706;
  --error: #DC2626;
  --critical: #991B1B;

  --focus: #22C55E;
}

.dark {
  /* =================================
     DARK MODE
     ================================= */

  --page-bg: #071A14;
  --surface-1: #0D261D;
  --surface-2: #123126;
  --surface-green: #123A2A;
  --surface-earth: #332418;

  --brand-950: #06150F;
  --brand-900: #0D261D;
  --brand-800: #123126;
  --brand-700: #153D2C;
  --brand-600: #34D399;
  --brand-500: #4ADE80;
  --brand-300: #BBF7D0;

  --earth-900: #3A2617;
  --earth-800: #5C3B23;
  --earth-700: #8A6039;
  --earth-500: #B9824E;
  --earth-300: #D6A46F;
  --earth-200: #E7C79E;

  --text-primary: #DCEBE2;
  --text-heading: #F0FDF4;
  --text-secondary: #B9CCC1;
  --text-muted: #91A39A;
  --text-disabled: #65756D;

  --border: #244438;
  --border-strong: #35584A;

  --success: #4ADE80;
  --info: #2DD4BF;
  --warning: #FBBF24;
  --error: #F87171;
  --critical: #FCA5A5;

  --focus: #4ADE80;
}
```

---

# 66. Recommended Tailwind Mapping

```text
brand-950 #052E22
brand-900 #0F3D2E
brand-800 #14532D
brand-700 #166534
brand-600 #15803D
brand-500 #22C55E
brand-300 #86EFAC

earth-900 #5C2F16
earth-800 #78350F
earth-700 #92400E
earth-500 #B45309
earth-300 #D6A46F
earth-200 #DEB887

surface-page #F7FAF5
surface-card #FFFFFF
surface-soft #F1F5EF
surface-green #ECFDF5
surface-earth #FBF4EA

text-primary #34413A
text-heading #0F3D2E
text-secondary #53635A
text-muted #718078

border #DDE5DF
border-strong #C6D4CA

success #16A34A
info #0F766E
warning #D97706
error #DC2626
```

---

# 67. Exact Component Priority

When implementing the deployed site, apply the colours in this order:

```text
1. Body background
2. Navbar
3. Sidebar
4. H1/H2/H3
5. Body text
6. Primary buttons
7. Secondary buttons
8. Cards
9. Inputs
10. Tables
11. Status badges
12. GIS
13. Charts
14. Modals
15. Footer
```

This prevents isolated components from developing unrelated colours.

---

# 68. Final BhoomiSetu Colour Formula

## Light Mode

```text
PAGE
#F7FAF5

CARDS
#FFFFFF

NAVBAR
#0F3D2E

HEADINGS
#0F3D2E

BODY TEXT
#34413A

PRIMARY BUTTON
#15803D

BRIGHT CTA
#22C55E

SECONDARY BUTTON
#FFFFFF + #166534 border/text

LAND ACCENT
#92400E

LAND BACKGROUND
#FBF4EA

GREEN BACKGROUND
#ECFDF5

BORDER
#DDE5DF
```

## Dark Mode

```text
PAGE
#071A14

CARDS
#0D261D

NAVBAR
#06150F

HEADINGS
#F0FDF4

BODY TEXT
#DCEBE2

PRIMARY BUTTON
#34D399

BRIGHT CTA
#86EFAC

SECONDARY BUTTON
#0D261D + #35584A border

LAND ACCENT
#D6A46F

LAND BACKGROUND
#332418

GREEN BACKGROUND
#123A2A

BORDER
#244438
```

---

# 69. One-Page Colour Cheat Sheet

```text
================ LIGHT MODE ================

Navbar             #0F3D2E
Page BG            #F7FAF5
Card               #FFFFFF
Section BG         #F1F5EF
Green BG           #ECFDF5
Earth BG           #FBF4EA

H1/H2              #0F3D2E
Body               #34413A
Secondary          #53635A
Muted              #718078

Primary Button     #15803D
CTA                #22C55E
Secondary Button   #FFFFFF
Land Button        #92400E

Border             #DDE5DF
Focus              #22C55E

Verified           #16A34A
Pending            #D97706
Info               #0F766E
Error              #DC2626
Critical           #991B1B


================ DARK MODE ================

Navbar             #06150F
Page BG            #071A14
Card               #0D261D
Section BG         #123126
Green BG           #123A2A
Earth BG           #332418

H1/H2              #F0FDF4
Body               #DCEBE2
Secondary          #B9CCC1
Muted              #91A39A

Primary Button     #34D399
CTA                #86EFAC
Secondary Button   #0D261D
Land Button        #D6A46F

Border             #244438
Focus              #4ADE80

Verified           #4ADE80
Pending            #FBBF24
Info               #2DD4BF
Error              #F87171
Critical           #FCA5A5
```

---

# 70. Final Implementation Rule

**Green owns the product.**

Use green for:

```text
Brand
Navigation
Actions
Verification
Success
Progress
GIS selected/verified states
```

**Brown supports the product.**

Use brown for:

```text
Land
Property
Soil
Survey
Agriculture
Heritage
Earth-related visuals
```

**Warm white owns the light interface.**

**Deep forest owns the dark interface.**

This keeps BhoomiSetu recognisable while preventing the UI from becoming visually overloaded by green or brown.

# END
