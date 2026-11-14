"""The product line, defined once. build.py turns this into the home-page line-up
and the cards on the Products page, so the two never drift apart.

Fields: id (anchor on products.html), name, text, bullets, fact (one short line of
ratings), img (file stem in site/assets/img/render), alt, quote (option preselected
on the quote form), link (optional extra link: label, href).
"""

CONFIGURE = {"industrial": "industrial", "professional": "professional", "jib": "jib", "gantry": "gantry", "monorail": "monorail"}

QUOTE_OPTIONS = {
    "bridge": "Workstation / bridge crane", "monorail": "Monorail", "jib": "Jib crane", "gantry": "Gantry crane",
    "tarping": "Tarping crane", "beam": "Lifting beam or spreader", "hoist": "Hoist only", "upgrade": "Upgrade or retrofit",
}

GROUPS = [
    {
        "id": "ezup", "family": "EZUP-built", "title": "EZUP cranes and components",
        "items": [
            {"id": "industrial", "name": "EZUP Industrial crane",
             "text": "Top-running workstation crane for heavy and high-cycle work.",
             "bullets": ["Up to 3 t, spans to 60 ft", "3-phase, VFD bridge and trolley", "Radio with two transmitters", "Demag DC-Pro hoist"],
             "fact": "Up to 3 t, spans to 60 ft", "img": "ezup-industrial", "quote": "bridge", "link": ("Lay one out in 3D", "ezup-cranes.html#layout"),
             "alt": "Rendering of an EZUP Industrial double-girder crane on a free-standing runway lifting a crate"},
            {"id": "professional", "name": "EZUP Professional crane",
             "text": "Lighter components for smaller shops on single-phase power.",
             "bullets": ["1 t and under", "120 V single phase", "Motorized or push-pull", "Demag DC-Com hoist"],
             "fact": "1 t and under, 120 V single phase", "img": "ezup-professional", "quote": "bridge",
             "alt": "Rendering of an EZUP Professional crane over a workbench in a small shop bay"},
            {"id": "kits", "name": "Component kits",
             "text": "End trucks, trolleys, wheel blocks and control panels with shop fabrication drawings, for crane builders.",
             "fact": "For crane builders", "img": "component-kit", "quote": None, "link": ("Builder program", "builders.html"),
             "alt": "Rendering of an EZUP component kit laid out on the floor: two end trucks with drives, a trolley, control panel, wheel blocks, radio transmitters and shop drawings"},
            {"id": "tiebacks", "name": "Runway tie-backs",
             "text": "Bracing kits that stiffen free-standing runways against crane travel loads.",
             "fact": "For free-standing runways", "img": "runway-tiebacks", "quote": "bridge",
             "alt": "Rendering of a free-standing crane runway tied back to building columns with yellow struts"},
        ],
    },
    {
        "id": "demag", "family": "Demag", "title": "Demag KBK and hoists",
        "items": [
            {"id": "kbk-workstation", "name": "KBK workstation cranes",
             "text": "Modular Demag KBK bridges and runways, ceiling-hung or free-standing, manual or powered.",
             "fact": "Demag-rated 80 kg to 3.2 t", "img": "kbk-workstation", "quote": "bridge",
             "alt": "Rendering of a free-standing light-rail workstation crane with a chain hoist over a workbench"},
            {"id": "kbk-monorail", "name": "KBK monorails",
             "text": "Straight runs, curves and switches that carry loads through a process.",
             "fact": "Straight runs, curves and switches", "img": "kbk-monorail", "quote": "monorail",
             "alt": "Rendering of a curved light-rail monorail hung from three steel frames, carrying a crate"},
            {"id": "kbk-jib", "name": "KBK jib cranes",
             "text": "Pillar and wall jibs for single workstations.",
             "fact": "Pillar and wall mounted", "img": "kbk-jib", "quote": "jib",
             "alt": "Rendering of a pillar jib crane with a light-rail arm, tie rod and chain hoist"},
            {"id": "hoists", "name": "Demag chain hoists",
             "text": "DC-Com, DC-Pro, DCS-Pro and Manulift, new or as replacements for worn hoists.",
             "fact": "DC-Com, DC-Pro, DCS-Pro, Manulift", "img": "chain-hoist", "quote": "hoist", "link": ("Hoist guide", "demag-kbk.html#hoists"),
             "alt": "Rendering of an electric chain hoist on a motorized trolley with a push-button pendant"},
        ],
    },
    {
        "id": "engineered", "family": "Engineered to order", "title": "Custom lifting equipment",
        "items": [
            {"id": "tarping", "name": "Tarping cranes",
             "text": "Radio-controlled cranes that place tarps on flatbed trailers so nobody climbs on the load. Indoors or free-standing outdoors.",
             "fact": "Quoted per project", "img": "tarping-crane", "quote": "tarping",
             "alt": "Rendering of a tarping crane lowering a tarp on a spreader bar over a flatbed trailer loaded with lumber"},
            {"id": "jib", "name": "Jib cranes",
             "text": "Heavy jibs beyond the KBK range, designed for your column, wall or foundation.",
             "fact": "Quoted per project", "img": "jib-crane", "quote": "jib",
             "alt": "Rendering of a free-standing jib crane with a yellow mast and boom lifting steel plate"},
            {"id": "gantry", "name": "Gantry cranes",
             "text": "Fixed or mobile gantries built to your span, height and capacity.",
             "fact": "Quoted per project", "img": "gantry-crane", "quote": "gantry",
             "alt": "Rendering of a mobile A-frame gantry crane on casters lifting a crate"},
            {"id": "monorail", "name": "Monorail systems",
             "text": "Free-standing, roof-supported or hybrid monorails for process lines.",
             "fact": "Quoted per project", "img": "monorail", "quote": "monorail",
             "alt": "Rendering of a free-standing monorail carrying baskets of parts over two process tanks"},
            {"id": "beams", "name": "Lifting beams and spreaders",
             "text": "Designed to ASME B30.20 and BTH-1, fabricated and load tested.",
             "fact": "ASME B30.20 and BTH-1", "img": "lifting-beam", "quote": "beam",
             "alt": "Rendering of a yellow lifting beam carrying a steel pipe on two round slings"},
            {"id": "upgrades", "name": "Upgrades and retrofits",
             "text": "Radio control and VFD kits, hoist replacement and inspections for cranes you already own.",
             "fact": "For cranes you already own", "img": "controls", "quote": "upgrade",
             "alt": "Rendering of an open crane control panel with variable frequency drives, two radio transmitters and a receiver"},
        ],
    },
]
