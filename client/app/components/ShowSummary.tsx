'use client'

import React, { useEffect, useState } from 'react'
import axios from 'axios'

export const ShowSummary = () => {
    const [data, setData] = useState(null)
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get("http://localhost:5000/summary")
                setData(res.data.summary)
                console.log(res.data) // Handle the response data as needed
            } catch (error) {
                console.error("Error fetching summary:", error)
            }
        }
        fetchData()
    }, []) // Empty dependency array ensures this runs only once

    return (
        <div>
            Hey this is where your summary will render

            {data && <p>{data}</p>}
        </div>
    )
}

export default ShowSummary
