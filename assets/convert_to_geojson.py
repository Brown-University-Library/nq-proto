import json

def convert_joined_data_to_geojson(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    features = []

    for person in data:
        # Extract person-level metadata
        standardname = person.get("name in standard form", "")
        author_id = person.get("authorId", "")
        gender = person.get("gender", "")
        birth_year = person.get("birth year", "")
        death_year = person.get("death year", "")

        # Process nested articles
        for article in person.get("articles", []):
            lat_str = article.get("latitude", "")
            lon_str = article.get("longitude", "")

            # Only create a GeoJSON feature if valid coordinates exist
            if lat_str and lon_str:
                try:
                    lat = float(lat_str)
                    lon = float(lon_str)
                except ValueError:
                    # Skip entries with unparseable coordinate strings
                    continue

                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat]  # GeoJSON standard is [longitude, latitude]
                    },
                    "properties": {
                        "standardname": standardname,
                        "authorId": author_id,
                        "gender": gender,
                        "birth_year": birth_year,
                        "death_year": death_year,
                        "town": article.get("town", ""),
                        "county": article.get("county", ""),
                        "country": article.get("country", "")
                    }
                }
                features.append(feature)

    geojson_data = {
        "type": "FeatureCollection",
        "features": features
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, ensure_ascii=False, indent=2)

    print(f"Successfully converted {len(features)} articles to {output_file}")

if __name__ == "__main__":
    convert_joined_data_to_geojson("joined_data.json", "markers.geojson")